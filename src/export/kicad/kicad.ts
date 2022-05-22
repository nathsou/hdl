import { Circuit, IO, KiCadConfig, metadata, Module, ModuleNode, Net, Num } from "../../core";
import { Rewire } from '../../sim/rewire';
import { createCache, Iter, occurences } from "../../utils";
import { parseSymbolLibrary, SymbolDef, SymbolPin } from './parse';
import { SExpr } from './s-expr';
import { FileSystem } from '../fs/fs';

export type SymbolOccurence = KiCadConfig<any, any> & {
  node: ModuleNode,
  def: SymbolDef,
};

export type KiCadLibraries = {
  symbols: Set<string>,
  footprints: Set<string>,
  querySymbol: (lib: string, part: string) => Promise<SymbolDef>,
  queryFootprint: (lib: string, part: string) => Promise<void>,
};

const findByExt = (files: string[], ext: string): string[] => {
  return files.filter(f => f.endsWith(ext)).map(f => f.replace(ext, ''));
};

const scanLibraries = async (libsDir: string, fs: FileSystem): Promise<KiCadLibraries> => {
  const symbolsDir = fs.joinPaths(libsDir, 'symbols');
  const footprintsDir = fs.joinPaths(libsDir, 'footprints');
  const symbolLibs = new Set(findByExt(await fs.readDir(symbolsDir), '.kicad_sym'));
  const footprintLibs = new Set(findByExt(await fs.readDir(footprintsDir), '.pretty'));
  const symbolsCache = createCache<string, Map<string, SymbolDef>>();
  const footprintsCache = createCache<string, Set<string>>();

  return {
    symbols: symbolLibs,
    footprints: footprintLibs,
    async querySymbol(lib, part): Promise<SymbolDef> {
      if (!symbolLibs.has(lib)) {
        throw new Error(`Symbol library '${lib}.kicad_sym' not found`);
      }

      const libParts = await symbolsCache.keyAsync(lib, async () => {
        const libFile = fs.joinPaths(symbolsDir, `${lib}.kicad_sym`);
        const contents = await fs.readFile(libFile);
        return parseSymbolLibrary(contents);
      });

      if (libParts.has(part)) {
        return libParts.get(part)!;
      } else {
        throw new Error(`Symbol '${part}' not found in symbol library '${lib}', available symbols:\n${[...libParts.keys()].join(', ')}`);
      }
    },
    async queryFootprint(lib, part): Promise<void> {
      if (!footprintLibs.has(lib)) {
        throw new Error(`Footprint library '${lib}.pretty' not found`);
      }

      const parts = await footprintsCache.keyAsync(lib, async () => {
        const libDir = fs.joinPaths(footprintsDir, `${lib}.pretty`);
        return new Set(findByExt(await fs.readDir(libDir), '.kicad_mod'));
      });

      if (!parts.has(part)) {
        throw new Error(`Footprint '${part}' not found in footprint library '${lib}', available footprints:\n${[...parts].join(', ')}`);
      }
    },
  };
};

const renameSymbolPins = (pins: SymbolPin[]): Record<number, string> => {
  const pinsObj: Record<number, string> = {};

  for (const { name, number } of pins) {
    pinsObj[number] = name === '~' ? `${number}` : name.toLowerCase();
  }

  return pinsObj;
};

const pinReverseMapping = (
  moduleName: string,
  pinWidths: Record<string, Num>,
  pinMapping: Record<number, string>
): Record<string, number> => {
  const reversePinMapping: Record<string, number> = {};
  const pinMappingEntries = Object.entries(pinMapping);

  const findPinNumber = (name: string) => {
    const pin = pinMappingEntries.find(([_, pin]) => pin.toLowerCase() === name);
    if (pin === undefined) {
      throw new Error(`Unmapped pin number for '${name}' in module '${moduleName}'`);
    }

    return Number(pin[0]);
  };

  for (const [name, width] of Object.entries(pinWidths)) {
    const lowerName = name.toLowerCase();
    if (width === 1) {
      reversePinMapping[lowerName] = findPinNumber(lowerName);
    } else {
      for (let i = 0; i < width; i++) {
        // add 1 in the rhs since pin numbers usually start at 1 in datasheets,
        // but not internally
        reversePinMapping[`${lowerName}${i}`] = findPinNumber(`${lowerName}${i + 1}`);
      }
    }
  }

  return reversePinMapping;
};

/**
 * gather all kicad symbols used in the circuit and perform basic checks
 */
const collectKiCadSymbols = async (top: Module<{}, {}>, libs: KiCadLibraries): Promise<SymbolOccurence[]> => {
  const { circuit, id } = metadata(top);
  const mod = circuit.modules.get(id)!;
  const topSig = circuit.signatures.get(mod.name)!;
  
  if (Object.keys(topSig.inputs).length + Object.keys(topSig.outputs).length > 0) {
    throw new Error(`Top module must define empty inputs and outputs when targetting KiCad`);
  }

  const kicadSymbols: SymbolOccurence[] = [];

  const aux = async (node: ModuleNode) => {
    const sig = circuit.signatures.get(node.name)!;
    if (node.simulate !== undefined && sig.kicad === undefined) {
      throw new Error(`Unspecified KiCad mapping for module '${node.name}'`);
    }

    if (sig.kicad !== undefined) {
      const [symbolLib, symbolPart] = sig.kicad.symbol.split(':');
      const [footprintLib, footprintPart] = sig.kicad.footprint.split(':');

      // ensure the specified symbol and footprint exist
      const symb = await libs.querySymbol(symbolLib, symbolPart);
      await libs.queryFootprint(footprintLib, footprintPart);

      // ensure the pins are correctly mapped
      if (symb.pins === undefined) {
        throw new Error(`Symbol '${symbolLib}:${symbolPart}' has no pins`);
      }

      const pins = sig.kicad.pins ? sig.kicad.pins : renameSymbolPins(symb.pins);
      sig.kicad.pins = pins;

      const expectedPins = new Set(Object.keys(pins).map(Number));
      const actualPins = new Set(symb.pins.map(p => p.number));

      if (expectedPins.size !== actualPins.size) {
        throw new Error(`Inconsistent pin count for symbol '${symbolLib}:${symbolPart}', expected ${expectedPins.size} pins, found ${actualPins.size}`);
      }

      const differences = [...expectedPins].filter(p => !actualPins.has(p));

      if (differences.length > 0) {
        throw new Error(`Extraneous pin(s): ${differences.join(', ')} for symbol '${symbolLib}:${symbolPart}'`);
      }

      const linearizedPins = IO.linearizePinout({ ...sig.inputs, ...sig.outputs }, true);
      const pinNameOccurences = new Map(linearizedPins.map(pin => [pin, 0]));

      for (const pinName of Object.values(pins)) {
        pinNameOccurences.set(pinName as string, pinNameOccurences.get(pinName as string)! + 1);
      }

      const unmappedPinNames = [...Iter.filter(pinNameOccurences, ([_, occ]) => occ === 0)].map(([name]) => name);

      if (unmappedPinNames.length > 0) {
        throw new Error(`Unmapped pin(s) for symbol '${symbolLib}:${symbolPart}': ${unmappedPinNames.join(', ')}`);
      }

      const pinNamesOccs = occurences(Object.values(pins));
      const duplicatePinNames = [...pinNamesOccs.entries()].filter(([_, count]) => count > 1);

      if (duplicatePinNames.length > 0) {
        throw new Error(`Duplicate pin name(s) for symbol '${symbolLib}:${symbolPart}': ${duplicatePinNames.map(([name]) => name).join(', ')}`);
      }

      kicadSymbols.push({ ...sig.kicad, node, def: symb });
    } else {
      for (const subMod of node.subModules) {
        await aux(subMod);
      }
    }
  };

  await aux(mod);

  return kicadSymbols;
};

/**
 * associate each net with its incoming and outcoming nets
 */
const collectNets = (circuit: Circuit): Map<Net, Set<Net>> => {
  const nets: { start: Net, end: Net }[] = [];
  const netMapping = createCache<Net, Set<Net>>();

  for (const [net, { in: inp, out }] of circuit.nets) {
    for (const incomingNet of inp) {
      nets.push({ start: incomingNet, end: net });
    }

    for (const outcomingNet of out) {
      nets.push({ start: net, end: outcomingNet });
    }
  }

  for (const { start, end } of nets) {
    const startNets = netMapping.key(start, () => new Set());
    const endNets = netMapping.key(end, () => new Set());

    startNets.add(end);
    endNets.add(start);
  }

  return netMapping.raw;
};

const generateNetlist = async (top: Module<{}, {}>, libsDir: string, fs: FileSystem): Promise<SExpr> => {
  const libs = await scanLibraries(libsDir, fs);
  const symbols = await collectKiCadSymbols(top, libs);
  const { num, str, sym, list } = SExpr;
  
  // 0 is the power module
  const kicadModuleIds = new Set([0, ...symbols.map(s => s.node.id)]);
  const circuit = Rewire.keepModules(metadata(top).circuit, node => kicadModuleIds.has(node.id));
  const reverseMappings = createCache<string, Record<string, number>>();
  const netlist = collectNets(circuit);

  return list(
    sym('export'),
    list(sym('version'), str('E')),
    list(
      sym('design'),
      list(sym('source'), str(fs.joinPaths(__dirname, __filename))),
      list(sym('date'), str(new Date().toISOString())),
      list(sym('tool'), str('nathsou_hdl (0.0.1)')),
    ),
    list(
      sym('components'),
      ...symbols.map(s => list(
        sym('comp'),
        list(sym('ref'), str(`${s.node.name}_${s.node.id}`)),
        list(sym('value'), str(s.node.name)),
        list(sym('footprint'), str(s.footprint)),
        list(
          sym('libsource'),
          list(sym('lib'), str(s.symbol.split(':')[0])),
          list(sym('part'), str(s.symbol.split(':')[1])),
        ),
      )),
    ),
    list(
      sym('nets'),
      ...Iter.map(netlist, ([netName, connectedNets], index) => {
        const connectedNodes = [netName, ...connectedNets]
          .filter(net => Net.modId(net) !== 0);

        return list(
          sym('net'),
          list(sym('code'), num(index)),
          list(sym('name'), str(netName)),
          ...connectedNodes.map(net => {
            const [pinName, modId] = Net.decompose(net);
            const mod = circuit.modules.get(modId)!;
            const sig = circuit.signatures.get(mod.name)!;
            const reverseMapping = reverseMappings.key(mod.name, () => {
              return pinReverseMapping(
                mod.name,
                { ...sig.inputs, ...sig.outputs },
                sig.kicad!.pins!,
              );
            });

            const pinNum = reverseMapping[pinName];

            return list(
              sym('node'),
              list(sym('ref'), str(`${mod.name}_${mod.id}`)),
              list(sym('pin'), num(pinNum)),
              list(sym('pinfunction'), str(pinName)),
            );
          }),
        );
      }),
    ),
  );
};

export const KiCad = {
  generateNetlist,
};