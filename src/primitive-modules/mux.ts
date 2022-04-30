import { Circuit, Connection, createModule, IO, Num } from "../core";
import { Range, Tuple } from "../utils";
import { GateModules } from "./gates";

export type MultiplexerModules = ReturnType<typeof createMultiplexers>;

export const createMultiplexers = (circuit: Circuit, { and, andN, not, orN, or }: GateModules) => {
  const mux1 = <N extends Num>(N: N) => createModule({
    name: `mux1_${N}`,
    inputs: { d0: N, d1: N, sel: 1 },
    outputs: { q: N },
    connect({ sel, d0, d1 }, out) {
      const lhs = andN(N);
      lhs.in.a = d0;
      lhs.in.b = IO.repeat(N, not(sel));

      const rhs = andN(N);
      rhs.in.a = IO.repeat(N, sel);
      rhs.in.b = d1;

      const res = orN(N);
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
    connect(inp, out) {
      const createMux3ToN = mux3(N);
      const m1 = createMux3ToN();
      const m2 = createMux3ToN();
      const m3 = mux1(N)();

      Range.iter(0, 8, i => {
        m1.in[`d${i}`] = inp[`d${i}`];
        m2.in[`d${i}`] = inp[`d${(i + 8) as Range<8, 16>}`];
      });

      m3.in.d0 = m1.out.q;
      m3.in.d1 = m2.out.q;

      const { sel } = inp;

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
    connect(inp, out) {
      const createMux4ToN = mux4(N);
      const m1 = createMux4ToN();
      const m2 = createMux4ToN();
      const m3 = mux1(N)();

      Range.iter(0, 16, i => {
        m1.in[`d${i}`] = inp[`d${i}`];
        m2.in[`d${i}`] = inp[`d${(i + 16) as Range<16, 32>}`];
      });

      m3.in.d0 = m1.out.q;
      m3.in.d1 = m2.out.q;

      const { sel } = inp;

      m1.in.sel = [sel[1], sel[2], sel[3], sel[4]];
      m2.in.sel = [sel[1], sel[2], sel[3], sel[4]];
      m3.in.sel = sel[0];

      out.q = m3.out.q;
    }
  }, circuit);

  type Pow2 = { 1: 2, 2: 4, 3: 8, 4: 16, 5: 32, 6: 64, 7: 128, 8: 256 };

  type Cases<Len extends keyof Pow2, N extends number> = Record<Range<0, Pow2[Len]>, IO<N>>;
  type CasesWithDefault<Len extends keyof Pow2, N extends number> = Cases<Len, N> | (Partial<Cases<Len, N>> & { _: IO<N> });

  const match = <N extends Num>(N: N) => <T extends IO<keyof Pow2>>(
    value: T,
    cases: CasesWithDefault<T extends any[] ? T['length'] : 1, N>
  ): IO<N> => {
    const ors: Tuple<Connection, N>[] = [];
    const valueTuple = IO.asArray(value);
    const isExhaustive = !Object.keys(cases).some(key => key === '_');
    const isMatchedOrs: Connection[] = [];

    const casesExceptDefault = Object.entries(cases).filter(([key]) => key !== '_');

    for (const [n, c] of casesExceptDefault) {
      const connectionTuple = IO.asArray(c);
      const bits = Tuple.bin(Number(n), valueTuple.length);
      const selected = and(...bits.map((b, i) => b === 1 ? valueTuple[i] : not(valueTuple[i])));
      ors.push(connectionTuple.map(c => and(selected, c)) as Tuple<Connection, N>);

      if (!isExhaustive) {
        isMatchedOrs.push(selected);
      }
    }

    if (!isExhaustive) {
      const defaultValue = (cases as { _: IO<N> })['_'];
      const defaultValueArray = IO.asArray(defaultValue);

      if (casesExceptDefault.length > 0) {
        const isMatched = or(...isMatchedOrs);
        const isNotMatched = not(isMatched);
        ors.push(defaultValueArray.map(c => and(isNotMatched, c)) as Tuple<Connection, N>);
      } else {
        ors.push(defaultValueArray as Tuple<Connection, N>);
      }
    }

    return IO.gen(N, i => or(...ors.map(o => o[i])));
  };

  return {
    mux1: <N extends Num>(N: N) => mux1(N)(),
    mux2: <N extends Num>(N: N) => mux2(N)(),
    mux3: <N extends Num>(N: N) => mux3(N)(),
    mux4: <N extends Num>(N: N) => mux4(N)(),
    mux5: <N extends Num>(N: N) => mux5(N)(),
    matchN: match,
    match1: match(1),
    match2: match(2),
    match3: match(3),
    match4: match(4),
    match5: match(5),
    match6: match(6),
    match7: match(7),
    match8: match(8),
  };
};