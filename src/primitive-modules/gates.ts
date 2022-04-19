import { Circuit, createModule, createPrimitiveModule, extend4, extend8, width } from "../core";

export type Gates = ReturnType<typeof createGates>;

export const createGates = (circuit: Circuit) => {
  const not = createPrimitiveModule({
    name: 'not',
    inputs: { d: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = inp.d === 0 ? 1 : 0;
    },
  }, circuit);

  const not4 = extend4(not, ['d'], 'q', 'not4', circuit);
  const not8 = extend8(not4, ['d'], 'q', 'not8', circuit);

  const and = createPrimitiveModule({
    name: 'and',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a && inp.b) ? 1 : 0;
    },
  }, circuit);

  const nand = createPrimitiveModule({
    name: 'nand',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a && inp.b) ? 0 : 1;
    },
  }, circuit);

  const or = createPrimitiveModule({
    name: 'or',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) ? 1 : 0;
    },
  }, circuit);

  const xor = createPrimitiveModule({
    name: 'xor',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) && !(inp.a && inp.b) ? 1 : 0;
    },
  }, circuit);

  const and4 = extend4(and, ['a', 'b'], 'q', 'and4', circuit);
  const and8 = extend8(and4, ['a', 'b'], 'q', 'and8', circuit);

  const xor4 = extend4(xor, ['a', 'b'], 'q', 'xor4', circuit);
  const xor8 = extend8(xor4, ['a', 'b'], 'q', 'xor8', circuit);

  const logicalAnd3 = createModule({
    name: 'logical_and3',
    inputs: { d: width[3] },
    outputs: { q: width[1] },
    connect(inp, out) {
      const and1 = and();
      const and2 = and();

      and1.in.a = inp.d[0];
      and1.in.b = inp.d[1];
      and2.in.a = and1.out.q;
      and2.in.b = inp.d[2];
      out.q = and2.out.q;
    },
  }, circuit);

  return {
    not,
    and,
    or,
    xor,
    nand,
    not4,
    not8,
    and4,
    and8,
    xor4,
    xor8,
    logicalAnd3,
  };
};