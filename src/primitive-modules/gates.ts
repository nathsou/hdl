import { Circuit, Connection, createModuleGroup, createPrimitiveModule, IO, Module, Num } from "../core";
import { assert } from "../utils";
import { MetaModules } from "./meta";

export type GateModules = ReturnType<typeof createGates>;

export const createGates = (circuit: Circuit, meta: MetaModules) => {
  const not = createPrimitiveModule({
    name: 'not',
    inputs: { d: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = inp.d === 0 ? 1 : 0;
    },
  }, circuit);

  const logicalNot = (d: Connection): Connection => createModuleGroup('logical_not', () => {
    const gate = not();
    gate.in.d = d;
    return gate.out.q;
  });

  const bitwiseNot = <N extends Num>(d: IO<N>): IO<N> => createModuleGroup('bitwise_not', () => {
    const N = IO.width(d);
    const extended = meta.extendN(N, not, ['d'], ['q'], `not${N}`)();
    extended.in.d = d;
    return extended.out.q;
  });

  const and = createPrimitiveModule({
    name: 'and',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a && inp.b) ? 1 : 0;
    },
  }, circuit);

  const nand = createPrimitiveModule({
    name: 'nand',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a && inp.b) ? 0 : 1;
    },
  }, circuit);


  const or = createPrimitiveModule({
    name: 'or',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) ? 1 : 0;
    },
  }, circuit);


  const nor = createPrimitiveModule({
    name: 'nor',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) ? 0 : 1;
    },
  }, circuit);

  const xor = createPrimitiveModule({
    name: 'xor',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) && !(inp.a && inp.b) ? 1 : 0;
    },
  }, circuit);

  const xnor = createPrimitiveModule({
    name: 'xnor',
    inputs: { a: 1, b: 1 },
    outputs: { q: 1 },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) && !(inp.a && inp.b) ? 0 : 1;
    },
  }, circuit);

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
      const extended = meta.extendN(N, gate, ['a', 'b'], ['q'], `${name}${N}`)();
      extended.in.a = a;
      extended.in.b = b;

      return extended.out.q;
    });
  };

  return {
    logicalNot,
    logicalAnd: logicalBinaryGateShorthand('and', and),
    logicalNand: logicalBinaryGateShorthand('nand', nand),
    logicalOr: logicalBinaryGateShorthand('or', or),
    logicalNor: logicalBinaryGateShorthand('nor', nor),
    logicalXor: logicalBinaryGateShorthand('xor', xor),
    logicalXnor: logicalBinaryGateShorthand('xnor', xnor),
    not: bitwiseNot,
    and: bitwiseBinaryGateShorthand('and', and),
    nand: bitwiseBinaryGateShorthand('nand', nand),
    or: bitwiseBinaryGateShorthand('or', or),
    nor: bitwiseBinaryGateShorthand('nor', nor),
    xor: bitwiseBinaryGateShorthand('xor', xor),
    xnor: bitwiseBinaryGateShorthand('xnor', xnor),
    raw: { and, nand, not, or, nor, xor, xnor },
  };
};