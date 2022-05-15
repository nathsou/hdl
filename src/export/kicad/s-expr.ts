
type SymbolAtom = { type: 'symbol', value: string };
type StringAtom = { type: 'string', value: string };
type NumberAtom = { type: 'number', value: number };

type SExprAtom = SymbolAtom | StringAtom | NumberAtom;
type SExprList = { type: 'list', elems: SExpr[] };

export type SExpr = SExprAtom | SExprList;

type SymbolToken = SymbolAtom;
type NumberToken = NumberAtom;
type StringToken = StringAtom;

type LeftParenToken = {
  type: '(',
};

type RightParenToken = {
  type: ')',
};

type Token = SymbolToken | LeftParenToken | RightParenToken | NumberToken | StringToken;

const Token = {
  spaces: new Set('\n\r\t '),
  digits: new Set('0123456789'),
  allowedChars: new Set('abcdefghijklmnopqrstuvwxyz_'),
  isDigit: (char: string) => Token.digits.has(char),
  isAllowedChar: (char: string) => Token.allowedChars.has(char),
  show(token: Token): string {
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
  },
};

export type IndexedSExpr = {
  name: string,
  atoms: SExprAtom[],
  children: IndexedSExpr[],
};

export const SExpr = {
  num: (n: number): SExpr => ({ type: 'number', value: n }),
  sym: (s: string): SExpr => ({ type: 'symbol', value: s }),
  str: (s: string): SExpr => ({ type: 'string', value: s }),
  list: (...elems: SExpr[]): SExpr => ({ type: 'list', elems }),
  tokenize(source: string): Token[] {
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

      if (Token.spaces.has(char)) {
        pos += 1;
      } else if (char === '(') {
        tokens.push({ type: '(' });
        pos += 1;
      } else if (char === ')') {
        tokens.push({ type: ')' });
        pos += 1;
      } else if (Token.isDigit(char) || char === '-') {
        const x = advanceWhile(c => Token.isDigit(c) || c === '.');
        tokens.push({ type: 'number', value: Number(x) });
      } else if (Token.isAllowedChar(char)) {
        const lexeme = advanceWhile(c => Token.isAllowedChar(c) || Token.isDigit(c));
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
  },
  parse(str: string): SExpr {
    const tokens = SExpr.tokenize(str);
    let pos = 0;

    const expect: (<Ty extends Token['type']>(token: Token, type: Ty) => asserts token is Token & { type: Ty }) = (token, type) => {
      if (token.type !== type || pos >= tokens.length) {
        throw new Error(`Expected a token of type ${type}, got ${Token.show(tokens[pos])} near ${tokens.slice(pos, 10).map(Token.show).join(' ')}`);
      }
    };

    const parseSExpr = (): SExpr => {
      const parseAtom = (): SExpr | undefined => {
        const tok = tokens[pos];
        if (tok.type !== '(' && tok.type !== ')') {
          pos += 1;
          return tok;
        }
      };

      const parseList = (): SExpr | undefined => {
        const list: SExprList = { type: 'list', elems: [] };

        expect(tokens[pos], '(');
        pos += 1;

        while (tokens[pos].type !== ')') {
          const elem = parseSExpr();
          if (elem) {
            list.elems.push(elem);
          }
        }

        expect(tokens[pos], ')');
        pos += 1;

        return list;
      };

      switch (tokens[pos].type) {
        case 'symbol':
        case 'string':
        case 'number':
          return parseAtom()!;
        case '(':
          return parseList()!;
        case ')':
          throw new Error(`Unexpected ')' near ${tokens.slice(pos, 10).map(Token.show).join(' ')}`);
      };
    };

    return parseSExpr();
  },
  show(expr: SExpr, format = true): string {
    const newline = format ? '\n' : '';

    const aux = (expr: SExpr, identation = 0): string => {
      switch (expr.type) {
        case 'symbol':
          return expr.value;
        case 'string':
          return `"${expr.value}"`;
        case 'number':
          return `${expr.value}`;
        case 'list':
          const ident = format ? '  '.repeat(identation) : '';
          return `${newline}${ident}(${expr.elems.map(elem => aux(elem, identation + 1)).join(' ')})`;
      }
    };

    return aux(expr);
  },
  index(expr: SExpr) {
    const index: IndexedSExpr = {
      name: '',
      atoms: [],
      children: [],
    };

    if (expr.type === 'list') {
      for (const [i, elem] of expr.elems.entries()) {
        if (elem.type === 'symbol' && i === 0) {
          index.name = elem.value;
        } else {
          if (elem.type === 'list') {
            index.children.push(SExpr.index(elem));
          } else {
            index.atoms.push(elem);
          }
        }
      }
    } else {
      throw new Error(`Expected a list, got ${SExpr.show(expr)}`);
    }

    return index;
  },
};
