import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { IO, KiCadConfig, metadata, Module, ModuleNode } from "../../core";
import { Iter, occurences } from "../../utils";
import { parseSymbolLibrary, SymbolDef } from './parse';
import { SExpr } from './s-expr';

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

const scanLibraries = async (libsDir: string): Promise<KiCadLibraries> => {
  const symbolsDir = join(libsDir, 'symbols');
  const footprintsDir = join(libsDir, 'footprints');
  const symbolLibs = new Set(findByExt(await readdir(symbolsDir), '.kicad_sym'));
  const footprintLibs = new Set(findByExt(await readdir(footprintsDir), '.pretty'));
  const symbolsCache = new Map<string, Map<string, SymbolDef>>();
  const footprintsCache = new Map<string, Set<string>>();

  return {
    symbols: symbolLibs,
    footprints: footprintLibs,
    async querySymbol(lib, part): Promise<SymbolDef> {
      if (!symbolLibs.has(lib)) {
        throw new Error(`Symbol library '${lib}.kicad_sym' not found`);
      }

      if (!symbolsCache.has(lib)) {
        const libFile = join(symbolsDir, `${lib}.kicad_sym`);
        const contents = (await readFile(libFile)).toString();
        const libParts = parseSymbolLibrary(contents);
        symbolsCache.set(lib, libParts);
      }

      const libParts = symbolsCache.get(lib)!;

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

      if (!footprintsCache.has(lib)) {
        const libDir = join(footprintsDir, `${lib}.pretty`);
        const parts = new Set(findByExt(await readdir(libDir), '.kicad_mod'));
        footprintsCache.set(lib, parts);
      }

      const parts = footprintsCache.get(lib)!;

      if (!parts.has(part)) {
        throw new Error(`Footprint '${part}' not found in footprint library '${lib}', available footprints:\n${[...parts].join(', ')}`);
      }
    },
  };
};

const collectUsedSymbols = async (top: Module<any, any>, libs: KiCadLibraries): Promise<SymbolOccurence[]> => {
  const { circuit, id } = metadata(top);
  const mod = circuit.modules.get(id)!;
  const kicadSymbols: SymbolOccurence[] = [];

  const aux = async (node: ModuleNode) => {
    const sig = circuit.signatures.get(node.name)!;
    if (node.simulate !== undefined && sig.kicad === undefined) {
      throw new Error(`Unspecified kicad mapping for module '${node.name}'`);
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

      const expectedPins = new Set(Object.keys(sig.kicad.pins).map(Number));
      const actualPins = new Set(symb.pins.map(p => p.number));

      if (expectedPins.size !== actualPins.size) {
        throw new Error(`Inconsistent pin count for symbol '${symbolLib}:${symbolPart}', expected ${expectedPins.size} pins, found ${actualPins.size}`);
      }

      const differences = [...expectedPins].filter(p => !actualPins.has(p));

      if (differences.length > 0) {
        throw new Error(`Extraneous pin(s): ${differences.join(', ')} for symbol '${symbolLib}:${symbolPart}'`);
      }

      const linearizedPins = IO.linearizePinout({ ...sig.inputs, ...sig.outputs });

      const pinNameOccurences = new Map(linearizedPins.map(pin => [pin, 0]));

      for (const pinName of Object.values(sig.kicad.pins)) {
        pinNameOccurences.set(pinName as string, pinNameOccurences.get(pinName as string)! + 1);
      }

      const unmappedPinNames = [...Iter.filter(pinNameOccurences, ([_, occ]) => occ === 0)].map(([name]) => name);

      if (unmappedPinNames.length > 0) {
        throw new Error(`Unmapped pin(s) for symbol '${symbolLib}:${symbolPart}': ${unmappedPinNames.join(', ')}`);
      }

      const pinNamesOccs = occurences(Object.values(sig.kicad.pins));
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

const generateNetlist = (symbols: SymbolOccurence[], top: Module<any, any>) => {
  const { num, str, sym, list } = SExpr;
  const { circuit } = metadata(top);

  // 0 is the power module
  const moduleIds = new Set([0, ...symbols.map(s => s.node.id)]);
  const symbolsNets = Iter.filter(circuit.nets, ([_, net]) => moduleIds.has(net.id));

  return list(
    sym('export'),
    list(sym('version'), str('E')),
    list(
      sym('design'),
      list(sym('source'), str(join(__dirname, __filename))),
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
      ...Iter.map(symbolsNets, ([netName, net], index) => {
        const connectedNodes = [netName, ...net.in, ...net.out]
          .map(net => [net, circuit.modules.get(Number(net.split(':')[1]))!] as const)
          .filter(([_, mod]) => mod.id !== 0 && moduleIds.has(mod.id));

        return list(
          sym('net'),
          list(sym('code'), num(index)),
          list(sym('name'), str(netName)),
          ...connectedNodes.map(([net, mod]) => {
            const sig = circuit.signatures.get(mod.name)!;
            const pinName = net.split(':')[0];
            const p = Object.entries(sig.kicad!.pins).find(([_id, name]) => name === pinName);

            if (!Array.isArray(p)) {
              console.log(net, sig.kicad!.pins, circuit.nets);
              throw new Error(`Pin '${pinName}' not found in the signature of module '${mod.name}'`);
            }

            return list(
              sym('node'),
              list(sym('ref'), str(`${mod.name}_${mod.id}`)),
              list(sym('pin'), num(Number(p[0]))),
              list(sym('pinfunction'), str(pinName)),
            );
          }),
        );
      }),
    ),
  );
};

export const KiCad = {
  scanLibraries,
  collectUsedSymbols,
  generateNetlist,
};