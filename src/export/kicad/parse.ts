
type Assert = (condition: unknown, message?: string) => asserts condition;

export const assert: Assert = (condition, msg) => {
  if (!condition) {
    throw new Error(`Assertion error: ${msg}`);
  }
};

export type SExpr = {
  name: string,
  attributes: (string | number)[],
  children: SExpr[],
};

type SymbolToken = {
  type: 'symbol',
  value: string,
};

type NumberToken = {
  type: 'number',
  value: number,
};

type StringToken = {
  type: 'string',
  value: string,
};

type LeftParenToken = {
  type: '(',
};

type RightParenToken = {
  type: ')',
};

type Token = SymbolToken | LeftParenToken | RightParenToken | NumberToken | StringToken;

const spaces = new Set('\n\r\t ');
const digits = new Set('0123456789');
const allowedChars = new Set('abcdefghijklmnopqrstuvwxyz_');

const isDigit = (char: string) => digits.has(char);
const isAllowedChar = (char: string) => allowedChars.has(char);

const tokenize = (source: string) => {
  let pos = 0;
  const tokens: Token[] = [];

  const throwUnrecorgnizedError = (): never => {
    throw new Error(`Unrecognized token near: '${source.slice(pos, 10)}', at ${pos}`);
  };

  const advanceWhile = (test: (char: string) => boolean) => {
    const start = pos;
    pos += 1;
    while (test(source[pos])) {
      if (pos >= source.length) {
        throwUnrecorgnizedError();
      }
      pos += 1;
    }

    return source.slice(start, pos);
  };

  while (pos < source.length) {
    const char = source[pos];

    if (spaces.has(char)) {
      pos += 1;
    } else if (char === '(') {
      tokens.push({ type: '(' });
      pos += 1;
    } else if (char === ')') {
      tokens.push({ type: ')' });
      pos += 1;
    } else if (isDigit(char) || char === '-') {
      const x = advanceWhile(c => isDigit(c) || c === '.');
      tokens.push({ type: 'number', value: Number(x) });
    } else if (isAllowedChar(char)) {
      const lexeme = advanceWhile(c => isAllowedChar(c) || isDigit(c));
      tokens.push({ type: 'symbol', value: lexeme });
    } else if (char === '"') {
      const lexeme = advanceWhile(c => c !== '"');
      pos += 1;
      tokens.push({ type: 'string', value: lexeme.slice(1) });
    } else {
      throwUnrecorgnizedError();
    }
  }

  return tokens;
};

export const showToken = (token: Token): string => {
  switch (token.type) {
    case '(':
      return '(';
    case ')':
      return ')';
    case 'number':
      return `${token.value}`;
    case 'string':
      return `"${token.value}"`;
    case 'symbol':
      return token.value;
  }
};

export const showSExpr = ({ name, attributes, children }: SExpr, identation = 0): string => {
  if (children.length == 0) {
    return `(${name} ${attributes.join(' ')})`;
  }

  const ident = '  '.repeat(identation);
  return `${ident}(${name} ${attributes.join(' ')}\n${ident}  ${children.map(e => showSExpr(e, identation + 1)).join(`\n${ident}  `)}\n${ident})`;
};

export const parse = (str: string): SExpr => {
  const tokens = tokenize(str);
  let pos = 0;

  const expect: (<Ty extends Token['type']>(token: Token, type: Ty) => asserts token is Token & { type: Ty }) = (token, type) => {
    if (token.type !== type || pos >= tokens.length) {
      throw new Error(`Expected a token of type ${type}, got ${showToken(tokens[pos])} near ${tokens.slice(pos, 10).map(showToken).join(' ')}`);
    }
  };

  const parseSExpr = (): SExpr => {
    expect(tokens[pos], '(');
    pos += 1;

    const name = tokens[pos];
    expect(name, 'symbol');
    pos += 1;

    const attributes: (StringToken | NumberToken | SymbolToken)[] = [];

    const children: SExpr[] = [];

    outer:
    while (pos < tokens.length) {
      const tok = tokens[pos];
      switch (tok.type) {
        case 'number':
        case 'string':
        case 'symbol':
          attributes.push(tok);
          pos += 1;
          break;
        case '(':
          const child = parseSExpr();
          children.push(child);
          pos += 1;
          break;
        case ')':
          break outer;
      }
    }

    return {
      name: name.value,
      attributes: attributes.map(attr => attr.value),
      children,
    };
  };

  return parseSExpr();
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
  raw: SExpr,
};

const parsePin = (expr: SExpr): SymbolPin => {
  if (expr.name !== 'pin') {
    throw new Error(`Invalid pin definition'`);
  }

  const childrenByName = indexChildren(expr.children);

  if (!childrenByName.has('name')) {
    throw new Error(`Pin name not found'`);
  }

  if (!childrenByName.has('number')) {
    throw new Error(`Pin number not found'`);
  }

  return {
    name: childrenByName.get('name')!.attributes[0].toString(),
    number: Number(childrenByName.get('number')!.attributes[0]),
  };
};

const indexChildren = (children: SExpr[]): Map<string, SExpr> => {
  return new Map(children.map(c => [c.name, c]));
};

const parseRectangle = (rect: SExpr): BoundingRect => {
  const children = indexChildren(rect.children);

  assert(children.has('start'), 'start not found in rectangle');
  assert(children.has('end'), 'end not found in rectangle');

  const [x1, y1] = children.get('start')!.attributes.map(Number);
  const [x2, y2] = children.get('end')!.attributes.map(Number);

  return {
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  };
};

const parseSymbol = (expr: SExpr): SymbolDef => {
  if (expr.name !== 'symbol') {
    throw new Error(`Invalid symbol definition'`);
  }

  const [name] = expr.attributes;
  const rect = expr.children.find(c => c.name === 'rectangle');
  const subSymbols = expr.children.filter(c => c.name === 'symbol').map(parseSymbol);

  let pins: SymbolPin[] | undefined = expr.children.filter(c => c.name === 'pin').map(parsePin);

  if (pins.length === 0) {
    pins = subSymbols.find(s => s.pins !== undefined)?.pins;
  }

  return {
    name: `${name}`,
    pins,
    boundingRect: rect ? parseRectangle(rect) : subSymbols.find(s => s.boundingRect !== undefined)?.boundingRect,
    subSymbols,
    raw: expr,
  };
};

export const parseSymbolLibrary = (source: string): Map<string, SymbolDef> => {
  const sexpr = parse(source);

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