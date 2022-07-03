import { Connection, createModuleGroup, defineModule, IO, Module, Num } from "../core";
import { assert } from "../utils";
import { extendN } from "./meta";

const binaryGate = (name: string, op: (a: boolean, b: boolean) => boolean) => {
  return defineModule({
    name,
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate({ a, b }, out) {
      if (a === 'x' || b === 'x') {
        out.q = 'x';
      } else {
        out.q = op(a === 1, b === 1) ? 1 : 0;
      }
    },
  });
};

export const gates = {
  not: defineModule({
    name: 'not',
    inputs: { d: 1 },
    outputs: { q: 1 },
    simulate({ d }, out) {
      if (d === 'x') {
        out.q = 'x';
      } else {
        out.q = d === 0 ? 1 : 0;
      }
    },
  }),
  and: binaryGate('and', (a, b) => a && b),
  nand: binaryGate('nand', (a, b) => !(a && b)),
  or: binaryGate('or', (a, b) => a || b),
  nor: binaryGate('nor', (a, b) => !(a || b)),
  xor: binaryGate('xor', (a, b) => (a || b) && !(a && b)),
  xnor: binaryGate('xnor', (a, b) => (!a && !b) || (a && b)),
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

export const lnot = (d: Connection): Connection => createModuleGroup('logical_not', () => {
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
export const land = logicalBinaryGateShorthand('and', gates.and);
export const lnand = logicalBinaryGateShorthand('nand', gates.nand);
export const lor = logicalBinaryGateShorthand('or', gates.or);
export const lnor = logicalBinaryGateShorthand('nor', gates.nor);
export const lxor = logicalBinaryGateShorthand('xor', gates.xor);
export const lxnor = logicalBinaryGateShorthand('xnor', gates.xnor);
export const not = bitwiseNot;
export const and = bitwiseBinaryGateShorthand('and', gates.and);
export const nand = bitwiseBinaryGateShorthand('nand', gates.nand);
export const or = bitwiseBinaryGateShorthand('or', gates.or);
export const nor = bitwiseBinaryGateShorthand('nor', gates.nor);
export const xor = bitwiseBinaryGateShorthand('xor', gates.xor);
export const xnor = bitwiseBinaryGateShorthand('xnor', gates.xnor);