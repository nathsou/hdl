import { IndexedSExpr, SExpr } from "./s-expr";


type Assert = (condition: unknown, message?: string) => asserts condition;

const assert: Assert = (condition, msg) => {
  if (!condition) {
    throw new Error(`Assertion error: ${msg}`);
  }
};

export type SymbolPin = {
  name: string,
  number: number,
};

export type BoundingRect = {
  start: { x: number, y: number },
  end: { x: number, y: number },
};

export type SymbolDef = {
  name: string,
  pins?: SymbolPin[],
  boundingRect?: BoundingRect,
  subSymbols?: SymbolDef[],
  raw: IndexedSExpr,
};

const parsePin = (expr: IndexedSExpr): SymbolPin => {
  if (expr.name !== 'pin') {
    throw new Error(`Invalid pin definition`);
  }

  const childrenByName = indexChildren(expr.children);

  if (!childrenByName.has('name')) {
    throw new Error(`Pin name not found`);
  }

  if (!childrenByName.has('number')) {
    throw new Error(`Pin number not found`);
  }

  return {
    name: childrenByName.get('name')!.atoms[0].value.toString(),
    number: Number(childrenByName.get('number')!.atoms[0].value),
  };
};

const indexChildren = (children: IndexedSExpr[]): Map<string, IndexedSExpr> => {
  return new Map(children.map(c => [c.name, c]));
};

const parseRectangle = (rect: IndexedSExpr): BoundingRect => {
  const children = indexChildren(rect.children);

  assert(children.has('start'), 'start not found in rectangle');
  assert(children.has('end'), 'end not found in rectangle');

  const [x1, y1] = children.get('start')!.atoms.map(n => Number(n.value));
  const [x2, y2] = children.get('end')!.atoms.map(n => Number(n.value));

  return {
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  };
};

const parseSymbol = (expr: IndexedSExpr): SymbolDef => {
  if (expr.name !== 'symbol') {
    throw new Error(`Invalid symbol definition'`);
  }

  const [name] = expr.atoms;
  const rect = expr.children.find(c => c.name === 'rectangle');
  const subSymbols = expr.children.filter(c => c.name === 'symbol').map(parseSymbol);

  let pins: SymbolPin[] | undefined = expr.children.filter(c => c.name === 'pin').map(parsePin);

  if (pins.length === 0) {
    // merge all pins from sub-symbols (units) without duplicate pin numbers
    const allPins = subSymbols.filter(s => s.pins !== undefined).flatMap(s => s.pins!);
    const pinNumbers = [...new Set(allPins.map(p => p.number))].sort((a, b) => a - b);

    const uniquePins: SymbolPin[] = [];

    for (const pinNum of pinNumbers) {
      uniquePins.push(allPins.find(p => p.number === pinNum)!);
    }

    pins = uniquePins;
  }

  return {
    name: `${name.value}`,
    pins,
    boundingRect: rect ? parseRectangle(rect) : subSymbols.find(s => s.boundingRect !== undefined)?.boundingRect,
    subSymbols,
    raw: expr,
  };
};

export const parseSymbolLibrary = (source: string): Map<string, SymbolDef> => {
  const sexpr = SExpr.index(SExpr.parse(source));

  if (sexpr.name !== 'kicad_symbol_lib') {
    throw new Error(`Invalid .kicad_sym file, expected 'kicad_symbol_lib'`);
  }

  const symbols: SymbolDef[] = [];

  for (const child of sexpr.children) {
    if (child.name === 'symbol') {
      symbols.push(parseSymbol(child));
    }
  }

  return new Map(symbols.map(s => [s.name, s]));
};