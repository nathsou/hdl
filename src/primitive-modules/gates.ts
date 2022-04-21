import { Circuit, Connection, createPrimitiveModule, Module, width } from "../core";
import { extendN, Multi } from "./meta";

export type GateModules = ReturnType<typeof createGates>;

export const createGates = (circuit: Circuit) => {
  const not1 = createPrimitiveModule({
    name: 'not',
    inputs: { d: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = inp.d === 0 ? 1 : 0;
    },
  }, circuit);

  const not = (d: Connection): Connection => {
    const gate = not1();
    gate.in.d = d;
    return gate.out.q;
  };

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


  const nor = createPrimitiveModule({
    name: 'nor',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) ? 0 : 1;
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

  const xnor = createPrimitiveModule({
    name: 'xnor',
    inputs: { a: width[1], b: width[1] },
    outputs: { q: width[1] },
    simulate(inp, out) {
      out.q = (inp.a || inp.b) && !(inp.a && inp.b) ? 0 : 1;
    },
  }, circuit);

  const tristateBufferN = <N extends number>(N: N) => createPrimitiveModule({
    name: `tristate_buffer${N}`,
    inputs: { d: N, enable: width[1] },
    outputs: { q: N },
    simulate(inp, out) {
      if (inp.enable) {
        out.q = inp.d;
      }
    },
  }, circuit);

  const binaryGateShorthand = (gate: () => Module<{ a: 1, b: 1 }, { q: 1 }>) => {
    return (a: Connection, b: Connection): Connection => {
      const g = gate();
      g.in.a = a;
      g.in.b = b;
      return g.out.q;
    };
  };

  type ExtendedGate<Name extends string> = {
    [_ in Name]: (a: Connection, b: Connection) => Connection
  } & {
      [N in (1 | 2 | 4 | 8 | 16 | 32) as `${Name}${N}`]: () => Module<{ a: N, b: N }, { q: N }>
    } & {
      [_ in `${Name}N`]: <N extends Multi>(N: N) => Module<{ a: N, b: N }, { q: N }>
    };

  const ext = extendN(circuit);
  const extendBinary = <Name extends string>(
    gate: () => Module<{ a: 1, b: 1 }, { q: 1 }>,
    name: Name
  ): ExtendedGate<Name> => {

    return {
      [name]: binaryGateShorthand(gate),
      [name + 1]: gate,
      [name + '2']: ext(2, gate, ['a', 'b'], ['q'], `${name}2`),
      [name + '4']: ext(4, gate, ['a', 'b'], ['q'], `${name}4`),
      [name + '8']: ext(8, gate, ['a', 'b'], ['q'], `${name}8`),
      [name + '16']: ext(16, gate, ['a', 'b'], ['q'], `${name}16`),
      [name + 'N']: <N extends Multi>(N: N) => ext(N, gate, ['a', 'b'], ['q'], `${name}${N}`)(),
    } as ExtendedGate<Name>;
  };

  return {
    not,
    not1,
    not2: ext(2, not1, ['d'], ['q'], 'not2'),
    not4: ext(4, not1, ['d'], ['q'], 'not4'),
    not8: ext(8, not1, ['d'], ['q'], 'not8'),
    not16: ext(16, not1, ['d'], ['q'], 'not16'),
    ...extendBinary(and, 'and'),
    ...extendBinary(nand, 'nand'),
    ...extendBinary(or, 'or'),
    ...extendBinary(nor, 'nor'),
    ...extendBinary(xor, 'xor'),
    ...extendBinary(xnor, 'xnor'),
    tristate1: tristateBufferN(1),
    tristate2: tristateBufferN(2),
    tristate4: tristateBufferN(4),
    tristate8: tristateBufferN(8),
    tristate16: tristateBufferN(16),
    tristateN: <N extends Multi>(N: N) => tristateBufferN(N)(),
  };
};