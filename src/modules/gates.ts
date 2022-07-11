import { Connection, createModuleGroup, defineModule, IO, Module, Nat } from "../core";
import { assert } from "../utils";
import { extend } from "./meta";

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

export const Not = defineModule({
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
});

export const And = binaryGate('and', (a, b) => a && b);
export const Nand = binaryGate('nand', (a, b) => !(a && b))
export const Or = binaryGate('or', (a, b) => a || b);
export const Nor = binaryGate('nor', (a, b) => !(a || b));
export const Xor = binaryGate('xor', (a, b) => (a || b) && !(a && b));
export const Xnor = binaryGate('xnor', (a, b) => (!a && !b) || (a && b));

const logicalBinaryGateShorthand = (name: string, gate: () => Module<{ a: 1, b: 1 }, { q: 1 }>) => {
  return (...inputs: Connection[]): Connection => createModuleGroup(`l${name}${inputs.length}`, () => {
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
  // @ts-ignore
  return <A extends IO<Nat>>(a: A, b: A): A => createModuleGroup(`${name}${IO.width(a)}`, () => {
    assert(IO.width(a) === IO.width(b));

    const N = IO.width(a);
    const extended = extend(N, gate, ['a', 'b'], ['q'], `${name}${N}`)();
    // @ts-ignore
    extended.in.a = a;
    // @ts-ignore
    extended.in.b = b;

    return extended.out.q;
  });
};

export const lnot = (d: Connection): Connection => createModuleGroup('lnot', () => {
  const gate = Not();
  gate.in.d = d;
  return gate.out.q;
});

// @ts-ignore
const bitwiseNot = <A extends IO<Nat>>(d: A): A => createModuleGroup('not', () => {
  const N = IO.width(d);
  const extended = extend(N, Not, ['d'], ['q'], `not${N}`)();
  // @ts-ignore
  extended.in.d = d;
  return extended.out.q;
});

// shorthands
export const land = logicalBinaryGateShorthand('and', And);
export const lnand = logicalBinaryGateShorthand('nand', Nand);
export const lor = logicalBinaryGateShorthand('or', Or);
export const lnor = logicalBinaryGateShorthand('nor', Nor);
export const lxor = logicalBinaryGateShorthand('xor', Xor);
export const lxnor = logicalBinaryGateShorthand('xnor', Xnor);
export const not = bitwiseNot;
export const and = bitwiseBinaryGateShorthand('and', And);
export const nand = bitwiseBinaryGateShorthand('nand', Nand);
export const or = bitwiseBinaryGateShorthand('or', Or);
export const nor = bitwiseBinaryGateShorthand('nor', Nor);
export const xor = bitwiseBinaryGateShorthand('xor', Xor);
export const xnor = bitwiseBinaryGateShorthand('xnor', Xnor);