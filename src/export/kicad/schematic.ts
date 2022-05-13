import { SymbolOccurence } from "./kicad";
import { SExpr } from "./parse";

export const createSchematic = (symbols: SymbolOccurence[]): SExpr => {
  const usedSymbols = [...new Set(symbols)];
  const placedSymbols = placeSymbols(symbols);

  return {
    name: 'kicad_sch',
    attributes: [],
    children: [
      {
        name: 'version',
        attributes: [{ type: 'number', value: 20211123 }],
        children: [],
      },
      {
        name: 'generator',
        attributes: [{ type: 'symbol', value: 'nathsou_hdl' }],
        children: [],
      },
      {
        name: 'lib_symbols',
        attributes: [],
        children: usedSymbols.map(s => s.def.raw),
      },
      ...placedSymbols.map(s => ({
        name: 'symbol',
        attributes: [],
        children: [
          {
            name: 'lib_id',
            attributes: [{ type: 'string', value: s.def.name } as const],
            children: [],
          },
          {
            name: 'at',
            attributes: [
              { type: 'number', value: s.position.x } as const,
              { type: 'number', value: s.position.y } as const,
              { type: 'number', value: 0 } as const,
            ],
            children: [],
          },
          {
            name: 'unit',
            attributes: [
              { type: 'number', value: 1 } as const,
            ],
            children: [],
          },
          {
            name: 'in_bom',
            attributes: [
              { type: 'symbol', value: 'yes' } as const,
            ],
            children: [],
          },
          {
            name: 'on_board',
            attributes: [
              { type: 'symbol', value: 'yes' } as const,
            ],
            children: [],
          },
          {
            name: 'property',
            attributes: [
              { type: 'string', value: 'Reference' } as const,
              { type: 'string', value: 'U?' } as const,
            ],
            children: [
              {
                name: 'id',
                attributes: [{ type: 'number', value: 0 } as const],
                children: [],
              },
              {
                name: 'at',
                attributes: [
                  { type: 'number', value: s.position.x } as const,
                  { type: 'number', value: s.position.y } as const,
                  { type: 'number', value: 0 } as const,
                ],
                children: [],
              },
            ],
          },
          {
            name: 'property',
            attributes: [
              { type: 'string', value: 'Value' } as const,
              { type: 'string', value: '~' } as const,
            ],
            children: [
              {
                name: 'id',
                attributes: [{ type: 'number', value: 1 } as const],
                children: [],
              }
            ],
          },
          {
            name: 'property',
            attributes: [
              { type: 'string', value: 'Footprint' } as const,
              { type: 'string', value: s.footprint } as const,
            ],
            children: [
              {
                name: 'id',
                attributes: [{ type: 'number', value: 2 } as const],
                children: [],
              },
              {
                name: 'effects',
                attributes: [{ type: 'symbol', value: 'hide' } as const],
                children: [],
              },
            ],
          },
        ],
      })),
    ]
  };
};

const margin = 20;

type PlacedSymbol = SymbolOccurence & { position: { x: number, y: number } };

const placeSymbols = (symbols: SymbolOccurence[]): PlacedSymbol[] => {
  const pos = { x: 30, y: 30 };

  const placement: PlacedSymbol[] = [];

  for (const symb of symbols) {
    if (symb.def.boundingRect === undefined) {
      throw new Error(`No bounding box found for symbol '${symb.def.name}'`);
    }

    const { start, end } = symb.def.boundingRect;
    const width = end.x - start.x;
    const height = end.y - start.y;

    placement.push({
      ...symb,
      position: { x: pos.x, y: pos.y },
    });

    pos.x += width + margin;
    pos.y += height + margin;
  }

  return placement;
};