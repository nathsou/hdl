import { SExpr, SymbolDef } from "./parse";

export const createSchematic = (symbols: Map<string, SymbolDef>): SExpr => {
  return {
    name: 'kicad_sch',
    attributes: [],
    children: [
      {
        name: 'lib_symbols',
        attributes: [],
        children: [symbols.get('74HC137')!.raw],
      },
    ]
  };
};