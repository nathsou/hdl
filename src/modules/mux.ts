import { Connection, defineModule, createModuleGroup, IO, Num } from "../core";
import { Range, Tuple } from "../utils";
import { and, land, lor, not, or } from "./gates";

export const mux = {
  mux2: <N extends Num>(N: N) => defineModule({
    name: `mux2_${N}`,
    inputs: { d0: N, d1: N, sel: 1 },
    outputs: { q: N },
    connect({ sel, d0, d1 }, out) {
      out.q = or(
        and(d0, IO.repeat(N, not<1>(sel))),
        and(d1, IO.repeat(N, sel))
      );
    }
  }),
  mux4: <N extends Num>(N: N) => defineModule({
    name: `mux4_${N}`,
    inputs: { d0: N, d1: N, d2: N, d3: N, sel: 2 },
    outputs: { q: N },
    connect({ sel, d0, d1, d2, d3 }, out) {
      const createMux2 = mux.mux2(N);
      const m1 = createMux2();
      const m2 = createMux2();
      const m3 = createMux2();

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
  }),
  mux8: <N extends Num>(N: N) => defineModule({
    name: `mux8_${N}`,
    inputs: { d0: N, d1: N, d2: N, d3: N, d4: N, d5: N, d6: N, d7: N, sel: 3 },
    outputs: { q: N },
    connect({ sel, d0, d1, d2, d3, d4, d5, d6, d7 }, out) {
      const createMux4 = mux.mux4(N);
      const m1 = createMux4();
      const m2 = createMux4();
      const m3 = mux.mux2(N)();

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
  }),
  mux16: <N extends Num>(N: N) => defineModule({
    name: `mux16_${N}`,
    inputs: {
      d0: N, d1: N, d2: N, d3: N, d4: N, d5: N, d6: N, d7: N,
      d8: N, d9: N, d10: N, d11: N, d12: N, d13: N, d14: N, d15: N,
      sel: 4
    },
    outputs: { q: N },
    connect(inp, out) {
      const createMux8 = mux.mux8(N);
      const m1 = createMux8();
      const m2 = createMux8();
      const m3 = mux.mux2(N)();

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
  }),
  mux32: <N extends Num>(N: N) => defineModule({
    name: `mux32_${N}`,
    inputs: {
      d0: N, d1: N, d2: N, d3: N, d4: N, d5: N, d6: N, d7: N,
      d8: N, d9: N, d10: N, d11: N, d12: N, d13: N, d14: N, d15: N,
      d16: N, d17: N, d18: N, d19: N, d20: N, d21: N, d22: N, d23: N,
      d24: N, d25: N, d26: N, d27: N, d28: N, d29: N, d30: N, d31: N,
      sel: 5
    },
    outputs: { q: N },
    connect(inp, out) {
      const createMux16 = mux.mux16(N);
      const m1 = createMux16();
      const m2 = createMux16();
      const m3 = mux.mux2(N)();

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
  }),
  demux2: <N extends Num>(N: N) => defineModule({
    name: `demux2_${N}`,
    inputs: { d: N, sel: 1 },
    outputs: { q0: N, q1: N },
    connect(inp, out) {
      out.q0 = and(inp.d, IO.repeat(N, not<1>(inp.sel)));
      out.q1 = and(inp.d, IO.repeat(N, inp.sel));
    }
  }),
  demux4: <N extends Num>(N: N) => defineModule({
    name: `demux4_${N}`,
    inputs: { d: N, sel: 2 },
    outputs: { q0: N, q1: N, q2: N, q3: N },
    connect(inp, out) {
      const createDemux2 = mux.demux2(N);
      const m1 = createDemux2();
      const m2 = createDemux2();
      const m3 = createDemux2();

      m3.in.d = inp.d;
      m3.in.sel = inp.sel[0];

      m1.in.d = m3.out.q0;
      m2.in.d = m3.out.q1;

      m1.in.sel = inp.sel[1];
      m2.in.sel = inp.sel[1];

      out.q0 = m1.out.q0;
      out.q1 = m1.out.q1;
      out.q2 = m2.out.q0;
      out.q3 = m2.out.q1;
    }
  }),
  demux8: <N extends Num>(N: N) => defineModule({
    name: `demux8_${N}`,
    inputs: { d: N, sel: 3 },
    outputs: Object.fromEntries(Range.map(0, 8, i => [`q${i}`, N])) as Record<`q${Range<0, 8>}`, N>,
    connect(inp, out) {
      const createDemux4 = mux.demux4(N);
      const m1 = createDemux4();
      const m2 = createDemux4();
      const m3 = mux.demux2(N)();

      m3.in.d = inp.d;
      m3.in.sel = inp.sel[0];

      m1.in.d = m3.out.q0;
      m2.in.d = m3.out.q1;

      m1.in.sel = [inp.sel[1], inp.sel[2]];
      m2.in.sel = [inp.sel[1], inp.sel[2]];

      Range.iter(0, 4, n => {
        out[`q${n}`] = m1.out[`q${n}`];
        out[`q${(n + 4) as Range<4, 8>}`] = m2.out[`q${n}`];
      });
    }
  }),
  demux16: <N extends Num>(N: N) => defineModule({
    name: `demux16_${N}`,
    inputs: { d: N, sel: 4 },
    outputs: Object.fromEntries(Range.map(0, 16, i => [`q${i}`, N])) as Record<`q${Range<0, 16>}`, N>,
    connect(inp, out) {
      const createDemux8 = mux.demux8(N);
      const m1 = createDemux8();
      const m2 = createDemux8();
      const m3 = mux.demux2(N)();

      m3.in.d = inp.d;
      m3.in.sel = inp.sel[0];

      m1.in.d = m3.out.q0;
      m2.in.d = m3.out.q1;

      m1.in.sel = [inp.sel[1], inp.sel[2], inp.sel[3]];
      m2.in.sel = [inp.sel[1], inp.sel[2], inp.sel[3]];

      Range.iter(0, 8, n => {
        out[`q${n}`] = m1.out[`q${n}`];
        out[`q${(n + 8) as Range<8, 16>}`] = m2.out[`q${n}`];
      });
    }
  }),
  demux32: <N extends Num>(N: N) => defineModule({
    name: `demux32_${N}`,
    inputs: { d: N, sel: 5 },
    outputs: Object.fromEntries(Range.map(0, 32, i => [`q${i}`, N])) as Record<`q${Range<0, 32>}`, N>,
    connect(inp, out) {
      const createDemux16 = mux.demux16(N);
      const m1 = createDemux16();
      const m2 = createDemux16();
      const m3 = mux.demux2(N)();

      m3.in.d = inp.d;
      m3.in.sel = inp.sel[0];

      m1.in.d = m3.out.q0;
      m2.in.d = m3.out.q1;

      m1.in.sel = [inp.sel[1], inp.sel[2], inp.sel[3], inp.sel[4]];
      m2.in.sel = [inp.sel[1], inp.sel[2], inp.sel[3], inp.sel[4]];

      Range.iter(0, 16, n => {
        out[`q${n}`] = m1.out[`q${n}`];
        out[`q${(n + 16) as Range<16, 32>}`] = m2.out[`q${n}`];
      });
    }
  }),
};

type Pow2 = { 1: 2, 2: 4, 3: 8, 4: 16, 5: 32, 6: 64, 7: 128 } & Record<number, number>;
type Log2 = { 2: 1, 4: 2, 8: 3, 16: 4, 32: 5, 64: 6, 128: 7 };

type Cases<Len extends keyof Pow2, N extends number> = Record<Range<0, Pow2[Len]>, IO<N>>;
type CasesWithDefault<Len extends keyof Pow2, N extends number> = Cases<Len, N> | (Partial<Cases<Len, N>> & { _: IO<N> });
const match = <N extends Num>(N: N) => <T extends IO<Num>>(
  value: T,
  cases: CasesWithDefault<T extends any[] ? T['length'] : 1, N>
): IO<N> => createModuleGroup(`match${N}${IO.width(value)}`, () => {
  const ors: Tuple<Connection, N>[] = [];
  const valueTuple = IO.asArray(value);
  const isExhaustive = !Object.keys(cases).some(key => key === '_');
  const isMatchedOrs: Connection[] = [];

  const casesExceptDefault = Object.entries(cases).filter(([key]) => key !== '_');

  for (const [n, c] of casesExceptDefault) {
    const connectionTuple = IO.asArray(c);
    const bits = Tuple.bin(Number(n), valueTuple.length);
    const selected = land(...bits.map((b, i) => b === 1 ? valueTuple[i] : not<1>(valueTuple[i])));
    ors.push(connectionTuple.map(c => and(selected, c)) as Tuple<Connection, N>);

    if (!isExhaustive) {
      isMatchedOrs.push(selected);
    }
  }

  if (!isExhaustive) {
    const defaultValue = (cases as { _: IO<N> })['_'];
    const defaultValueArray = IO.asArray(defaultValue);

    if (casesExceptDefault.length > 0) {
      const isMatched = lor(...isMatchedOrs);
      const isNotMatched = not(isMatched);
      ors.push(defaultValueArray.map(c => and(isNotMatched, c)) as Tuple<Connection, N>);
    } else {
      ors.push(defaultValueArray as Tuple<Connection, N>);
    }
  }

  return IO.gen(N, i => lor(...ors.map(o => o[i])));
});

// export const decoder = <N extends 2 | 4 | 8 | 16 | 32>(N: N, sel: IO<Log2[N]>): IO<N> => {
//   const demux = raw[`demux${N}`](1)();
//   demux.in.d = 1;
//   demux.in.sel = sel;

//   /// @ts-ignore
//   return Range.map(0, N, n => demux.out[`q${n}`]);
// };

export const decoder = <N extends 2 | 4 | 8 | 16 | 32>(N: N, sel: IO<Log2[N]>): IO<N> => {
  const d = defineModule({
    name: `decoder_sim_${N}`,
    inputs: { sel: IO.width(sel) },
    outputs: { q: N },
    simulate(inp, out) {
      const n = parseInt(IO.asArray(inp.sel).join(''), 2);
      /// @ts-ignore
      out.q = Range.map(0, N, i => i === n ? 1 : 0);
    }
  })();

  d.in.sel = sel;

  return d.out.q;
};

export const mux2 = <N extends Num>(N: N) => mux.mux2(N)();
export const mux4 = <N extends Num>(N: N) => mux.mux4(N)();
export const mux8 = <N extends Num>(N: N) => mux.mux8(N)();
export const mux16 = <N extends Num>(N: N) => mux.mux16(N)();
export const mux32 = <N extends Num>(N: N) => mux.mux32(N)();
export const demux2 = <N extends Num>(N: N) => mux.demux2(N)();
export const demux4 = <N extends Num>(N: N) => mux.demux4(N)();
export const demux8 = <N extends Num>(N: N) => mux.demux8(N)();
export const demux16 = <N extends Num>(N: N) => mux.demux16(N)();
export const demux32 = <N extends Num>(N: N) => mux.demux32(N)();
export const matchN = match;
export const match1 = match(1);
export const match2 = match(2);
export const match3 = match(3);
export const match4 = match(4);
export const match5 = match(5);
export const match6 = match(6);
export const match7 = match(7);
export const match8 = match(8);
export const match16 = match(16);