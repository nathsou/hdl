import { Circuit, Connection, createModule, createPrimitiveModule, Module, Num } from "../core";
import { MetaModules } from "./meta";

export type GateModules = ReturnType<typeof createGates>;

export const createGates = (circuit: Circuit, meta: MetaModules) => {
  const not1 = createPrimitiveModule({
    name: 'not',
    inputs: { d: 1 },
    outputs: { q: 1 },
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

  const logicalBinaryGateShorthand = (gate: () => Module<{ a: 1, b: 1 }, { q: 1 }>) => {
    return (...inputs: Connection[]): Connection => {
      let chain = inputs[0];

      for (let i = 1; i < inputs.length; i++) {
        const g = gate();
        g.in.a = chain;
        g.in.b = inputs[i];
        chain = g.out.q;
      }

      return chain;
    };
  };

  type ExtendedGate<Name extends string> = {
    [_ in Name]: (...inputs: Connection[]) => Connection
  } & {
      [N in (1 | 2 | 4 | 8 | 16) as `${Name}${N}`]: () => Module<{ a: N, b: N }, { q: N }>
    } & {
      [_ in `${Name}N`]: <N extends Num>(N: N) => Module<{ a: N, b: N }, { q: N }>
    };

  const extendBinary = <Name extends string>(
    gate: () => Module<{ a: 1, b: 1 }, { q: 1 }>,
    name: Name
  ): ExtendedGate<Name> => {

    return {
      [name]: logicalBinaryGateShorthand(gate),
      [name + '1']: gate,
      [name + '2']: meta.extendN(2, gate, ['a', 'b'], ['q'], `${name}2`),
      [name + '4']: meta.extendN(4, gate, ['a', 'b'], ['q'], `${name}4`),
      [name + '8']: meta.extendN(8, gate, ['a', 'b'], ['q'], `${name}8`),
      [name + '16']: meta.extendN(16, gate, ['a', 'b'], ['q'], `${name}16`),
      [name + 'N']: <N extends Num>(N: N) => meta.extendN(N, gate, ['a', 'b'], ['q'], `${name}${N}`)(),
    } as ExtendedGate<Name>;
  };

  const shorthands = {
    not,
    not1,
    not2: meta.extendN(2, not1, ['d'], ['q'], 'not2'),
    not4: meta.extendN(4, not1, ['d'], ['q'], 'not4'),
    not8: meta.extendN(8, not1, ['d'], ['q'], 'not8'),
    not16: meta.extendN(16, not1, ['d'], ['q'], 'not16'),
    notN: <N extends Num>(N: N) => meta.extendN(N, not1, ['d'], ['q'], `not${N}`)(),
    ...extendBinary(and, 'and'),
    ...extendBinary(nand, 'nand'),
    ...extendBinary(or, 'or'),
    ...extendBinary(nor, 'nor'),
    ...extendBinary(xor, 'xor'),
    ...extendBinary(xnor, 'xnor'),
  };

  const mux1 = <N extends Num>(N: N) => createModule({
    name: `mux1_${N}`,
    inputs: { d0: N, d1: N, sel: 1 },
    outputs: { q: N },
    connect({ sel, d0, d1 }, out) {
      const lhs = shorthands.andN(N);
      lhs.in.a = d0;
      lhs.in.b = Connection.repeat(N, shorthands.not(sel));

      const rhs = shorthands.andN(N);
      rhs.in.a = Connection.repeat(N, sel);
      rhs.in.b = d1;

      const res = shorthands.orN(N);
      res.in.a = lhs.out.q;
      res.in.b = rhs.out.q;

      out.q = res.out.q;
    }
  }, circuit);

  const mux2 = <N extends Num>(N: N) => createModule({
    name: `mux2_${N}`,
    inputs: { d0: N, d1: N, d2: N, d3: N, sel: 2 },
    outputs: { q: N },
    connect({ sel, d0, d1, d2, d3 }, out) {
      const createMux1ToN = mux1(N);
      const m1 = createMux1ToN();
      const m2 = createMux1ToN();
      const m3 = createMux1ToN();

      m1.in.d0 = d0;
      m2.in.d0 = d1;
      m1.in.d1 = d2;
      m2.in.d1 = d3;
      m3.in.d0 = m1.out.q;
      m3.in.d1 = m2.out.q;

      m1.in.sel = sel[0];
      m2.in.sel = sel[0];
      m3.in.sel = sel[1];

      out.q = m3.out.q;
    }
  }, circuit);

  const mux3 = <N extends Num>(N: N) => createModule({
    name: `mux3_${N}`,
    inputs: { d0: N, d1: N, d2: N, d3: N, d4: N, d5: N, d6: N, d7: N, sel: 3 },
    outputs: { q: N },
    connect({ sel, d0, d1, d2, d3, d4, d5, d6, d7 }, out) {
      const createMux2ToN = mux2(N);
      const m1 = createMux2ToN();
      const m2 = createMux2ToN();
      const m3 = mux1(N)();

      m1.in.d0 = d0;
      m1.in.d1 = d1;
      m1.in.d2 = d2;
      m1.in.d3 = d3;

      m2.in.d0 = d4;
      m2.in.d1 = d5;
      m2.in.d2 = d6;
      m2.in.d3 = d7;

      m3.in.d0 = m1.out.q;
      m3.in.d1 = m2.out.q;

      m1.in.sel = [sel[1], sel[2]];
      m2.in.sel = [sel[1], sel[2]];
      m3.in.sel = sel[0];

      out.q = m3.out.q;
    }
  }, circuit);

  const mux4 = <N extends Num>(N: N) => createModule({
    name: `mux4_${N}`,
    inputs: {
      d0: N, d1: N, d2: N, d3: N, d4: N, d5: N, d6: N, d7: N,
      d8: N, d9: N, d10: N, d11: N, d12: N, d13: N, d14: N, d15: N,
      sel: 4
    },
    outputs: { q: N },
    connect({
      sel, d0, d1, d2, d3, d4, d5, d6, d7,
      d8, d9, d10, d11, d12, d13, d14, d15
    }, out) {
      const createMux3ToN = mux3(N);
      const m1 = createMux3ToN();
      const m2 = createMux3ToN();
      const m3 = mux1(N)();

      m1.in.d0 = d0;
      m1.in.d1 = d1;
      m1.in.d2 = d2;
      m1.in.d3 = d3;
      m1.in.d4 = d4;
      m1.in.d5 = d5;
      m1.in.d6 = d6;
      m1.in.d7 = d7;

      m2.in.d0 = d8;
      m2.in.d1 = d9;
      m2.in.d2 = d10;
      m2.in.d3 = d11;
      m2.in.d4 = d12;
      m2.in.d5 = d13;
      m2.in.d6 = d14;
      m2.in.d7 = d15;

      m3.in.d0 = m1.out.q;
      m3.in.d1 = m2.out.q;

      m1.in.sel = [sel[1], sel[2], sel[3]];
      m2.in.sel = [sel[1], sel[2], sel[3]];
      m3.in.sel = sel[0];

      out.q = m3.out.q;
    }
  }, circuit);

  const mux5 = <N extends Num>(N: N) => createModule({
    name: `mux5_${N}`,
    inputs: {
      d0: N, d1: N, d2: N, d3: N, d4: N, d5: N, d6: N, d7: N,
      d8: N, d9: N, d10: N, d11: N, d12: N, d13: N, d14: N, d15: N,
      d16: N, d17: N, d18: N, d19: N, d20: N, d21: N, d22: N, d23: N,
      d24: N, d25: N, d26: N, d27: N, d28: N, d29: N, d30: N, d31: N,
      sel: 5
    },
    outputs: { q: N },
    connect({
      sel, d0, d1, d2, d3, d4, d5, d6, d7,
      d8, d9, d10, d11, d12, d13, d14, d15,
      d16, d17, d18, d19, d20, d21, d22, d23,
      d24, d25, d26, d27, d28, d29, d30, d31
    }, out) {
      const createMux4ToN = mux4(N);
      const m1 = createMux4ToN();
      const m2 = createMux4ToN();
      const m3 = mux1(N)();

      m1.in.d0 = d0;
      m1.in.d1 = d1;
      m1.in.d2 = d2;
      m1.in.d3 = d3;
      m1.in.d4 = d4;
      m1.in.d5 = d5;
      m1.in.d6 = d6;
      m1.in.d7 = d7;
      m1.in.d8 = d8;
      m1.in.d9 = d9;
      m1.in.d10 = d10;
      m1.in.d11 = d11;
      m1.in.d12 = d12;
      m1.in.d13 = d13;
      m1.in.d14 = d14;
      m1.in.d15 = d15;

      m2.in.d0 = d16;
      m2.in.d1 = d17;
      m2.in.d2 = d18;
      m2.in.d3 = d19;
      m2.in.d4 = d20;
      m2.in.d5 = d21;
      m2.in.d6 = d22;
      m2.in.d7 = d23;
      m2.in.d8 = d24;
      m2.in.d9 = d25;
      m2.in.d10 = d26;
      m2.in.d11 = d27;
      m2.in.d12 = d28;
      m2.in.d13 = d29;
      m2.in.d14 = d30;
      m2.in.d15 = d31;

      m3.in.d0 = m1.out.q;
      m3.in.d1 = m2.out.q;

      m1.in.sel = [sel[1], sel[2], sel[3], sel[4]];
      m2.in.sel = [sel[1], sel[2], sel[3], sel[4]];
      m3.in.sel = sel[0];

      out.q = m3.out.q;
    }
  }, circuit);

  const binaryEncoder2 = createModule({
    name: 'binaryEncoder2',
    inputs: { d: 4 },
    outputs: { q: 2 },
    connect({ d }, out) {
      const [y3, y2, y1, _y0] = d;
      out.q = [shorthands.or(y3, y2), shorthands.or(y3, y1)];
    }
  }, circuit);

  return {
    ...shorthands,
    mux1: <N extends Num>(N: N) => mux1(N)(),
    mux2: <N extends Num>(N: N) => mux2(N)(),
    mux3: <N extends Num>(N: N) => mux3(N)(),
    mux4: <N extends Num>(N: N) => mux4(N)(),
    mux5: <N extends Num>(N: N) => mux5(N)(),
    binaryEncoder1: binaryEncoder2,
  };
};