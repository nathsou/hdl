import { KiCadConfig, metadata, Module, ModuleNode } from "../../core";
import { Iter, occurences } from "../../utils";
import { KiCadLibraries } from "./libs";
import { SymbolDef } from "./parse";

export type SymbolOccurence = KiCadConfig<any, any> & {
  node: ModuleNode,
  def: SymbolDef,
};

export const collectUsedSymbols = async (top: Module<any, any>, libs: KiCadLibraries): Promise<SymbolOccurence[]> => {
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

      const pinNameOccurences = new Map(
        Iter.map(
          Iter.join(Object.keys(sig.inputs), Object.keys(sig.outputs)),
          name => [name, 0]
        )
      );

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