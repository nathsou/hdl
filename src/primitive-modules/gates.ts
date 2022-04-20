import { Circuit, Connection, createPrimitiveModule, Module, MultiIO, Num, Tuple, width } from "../core";
import { gen, genConnections, mapTuple } from "../utils";

export type Gates = ReturnType<typeof createGates>;

export const createGates = (circuit: Circuit) => {
  const not_ = createPrimitiveModule({
    name: 'not',
    inputs: { d: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = inp.d === 0 ? 1 : 0;
    },
  }, circuit);

  const not = (d: Connection): Connection => {
    const gate = not_();
    gate.in.d = d;
    return gate.out.q;
  };

  const and_ = createPrimitiveModule({
    name: 'and',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a && inp.b) ? 1 : 0;
    },
  }, circuit);

  const and = (a: Connection, b: Connection): Connection => {
    const g = and_();
    g.in.a = a;
    g.in.b = b;
    return g.out.q;
  };

  const nand_ = createPrimitiveModule({
    name: 'nand',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a && inp.b) ? 0 : 1;
    },
  }, circuit);

  const nand = (a: Connection, b: Connection): Connection => {
    const g = nand_();
    g.in.a = a;
    g.in.b = b;
    return g.out.q;
  };

  const or_ = createPrimitiveModule({
    name: 'or',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) ? 1 : 0;
    },
  }, circuit);

  const or = (a: Connection, b: Connection): Connection => {
    const g = or_();
    g.in.a = a;
    g.in.b = b;
    return g.out.q;
  };

  const nor_ = createPrimitiveModule({
    name: 'nor',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) ? 0 : 1;
    },
  }, circuit);

  const nor = (a: Connection, b: Connection): Connection => {
    const g = nor_();
    g.in.a = a;
    g.in.b = b;
    return g.out.q;
  };

  const xor_ = createPrimitiveModule({
    name: 'xor',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) && !(inp.a && inp.b) ? 1 : 0;
    },
  }, circuit);

  const xor = (a: Connection, b: Connection): Connection => {
    const g = xor_();
    g.in.a = a;
    g.in.b = b;
    return g.out.q;
  };

  const xnor_ = createPrimitiveModule({
    name: 'xor',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) && !(inp.a && inp.b) ? 0 : 1;
    },
  }, circuit);

  const xnor = (a: Connection, b: Connection): Connection => {
    const g = xnor_();
    g.in.a = a;
    g.in.b = b;
    return g.out.q;
  };

  return {
    not, not_,
    and, and_,
    nand, nand_,
    or, or_,
    nor, nor_,
    xor, xor_,
    xnor, xnor_,
  };
};