import { Circuit, createPrimitiveModule, width } from "../core";

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

  return {
    not,
    and,
    or,
    xor,
    nand,
  };
};