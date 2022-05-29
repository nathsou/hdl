import { Connection, createModuleGroup, defineModule, IO, Module, Num } from "../core";
import { assert } from "../utils";
import { extendN } from "./meta";

export const gates = {
  not: defineModule({
    name: 'not',
    inputs: { d: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = inp.d === 0 ? 1 : 0;
    },
  }),
  and: defineModule({
    name: 'and',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a && inp.b) ? 1 : 0;
    },
  }),
  nand: defineModule({
    name: 'nand',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a && inp.b) ? 0 : 1;
    },
  }),
  or: defineModule({
    name: 'or',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) ? 1 : 0;
    },
  }),
  nor: defineModule({
    name: 'nor',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) ? 0 : 1;
    },
  }),
  xor: defineModule({
    name: 'xor',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) && !(inp.a && inp.b) ? 1 : 0;
    },
  }),
  xnor: defineModule({
    name: 'xnor',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) && !(inp.a && inp.b) ? 0 : 1;
    },
  }),
};

const logicalBinaryGateShorthand = (name: string, gate: () => Module<{ a: 1, b: 1 }, { q: 1 }>) => {
  return (...inputs: Connection[]): Connection => createModuleGroup(`logical_${name}${inputs.length}`, () => {
    let chain = inputs[0];

    for (let i = 1; i < inputs.length; i++) {
      const g = gate();
      g.in.a = chain;
      g.in.b = inputs[i];
      chain = g.out.q;
    }

    return chain;
  });
};

const bitwiseBinaryGateShorthand = (name: string, gate: () => Module<{ a: 1, b: 1 }, { q: 1 }>) => {
  return <N extends Num>(a: IO<N>, b: IO<N>): IO<N> => createModuleGroup(`bitwise_${name}${IO.width(a)}`, () => {
    assert(IO.width(a) === IO.width(b));
    const N = IO.width(a);
    const extended = extendN(N, gate, ['a', 'b'], ['q'], `${name}${N}`)();
    extended.in.a = a;
    extended.in.b = b;

    return extended.out.q;
  });
};

export const logicalNot = (d: Connection): Connection => createModuleGroup('logical_not', () => {
  const gate = gates.not();
  gate.in.d = d;
  return gate.out.q;
});

const bitwiseNot = <N extends Num>(d: IO<N>): IO<N> => createModuleGroup('bitwise_not', () => {
  const N = IO.width(d);
  const extended = extendN(N, gates.not, ['d'], ['q'], `not${N}`)();
  extended.in.d = d;
  return extended.out.q;
});

// shorthands
export const logicalAnd = logicalBinaryGateShorthand('and', gates.and);
export const logicalNand = logicalBinaryGateShorthand('nand', gates.nand);
export const logicalOr = logicalBinaryGateShorthand('or', gates.or);
export const logicalNor = logicalBinaryGateShorthand('nor', gates.nor);
export const logicalXor = logicalBinaryGateShorthand('xor', gates.xor);
export const logicalXnor = logicalBinaryGateShorthand('xnor', gates.xnor);
export const not = bitwiseNot;
export const and = bitwiseBinaryGateShorthand('and', gates.and);
export const nand = bitwiseBinaryGateShorthand('nand', gates.nand);
export const or = bitwiseBinaryGateShorthand('or', gates.or);
export const nor = bitwiseBinaryGateShorthand('nor', gates.nor);
export const xor = bitwiseBinaryGateShorthand('xor', gates.xor);
export const xnor = bitwiseBinaryGateShorthand('xnor', gates.xnor);