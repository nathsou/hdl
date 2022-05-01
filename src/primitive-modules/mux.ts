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

  type Pow2 = { 1: 2, 2: 4, 3: 8, 4: 16, 5: 32, 6: 64, 7: 128 } & Record<number, number>;

  type Cases<Len extends keyof Pow2, N extends number> = Record<Range<0, Pow2[Len]>, IO<N>>;
  type CasesWithDefault<Len extends keyof Pow2, N extends number> = Cases<Len, N> | (Partial<Cases<Len, N>> & { _: IO<N> });

  const match = <N extends Num>(N: N) => <T extends IO<Num>>(
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

  const binaryDecoder2 = createModule({
    name: 'binary_decoder_2',
    inputs: { d: 4 },
    outputs: { q: 2 },
    connect({ d }, out) {
      const [y3, y2, y1, _y0] = d;
      out.q = [or(y3, y2), or(y3, y1)];
    }
  }, circuit);

  const demux2 = <N extends Num>(N: N) => createModule({
    name: `demux2_${N}`,
    inputs: { d: N, sel: 1 },
    outputs: { q0: N, q1: N },
    connect(inp, out) {
      const ands0 = andN(N);
      const ands1 = andN(N);

      ands0.in.a = inp.d;
      ands0.in.b = IO.repeat(N, not(inp.sel));

      ands1.in.a = inp.d;
      ands1.in.b = IO.repeat(N, inp.sel);

      out.q0 = ands0.out.q;
      out.q1 = ands1.out.q;
    }
  }, circuit);

  const demux4 = <N extends Num>(N: N) => createModule({
    name: `demux4_${N}`,
    inputs: { d: N, sel: 2 },
    outputs: { q0: N, q1: N, q2: N, q3: N },
    connect(inp, out) {
      const createDemux2 = demux2(N);
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
  }, circuit);

  const demux8 = <N extends Num>(N: N) => createModule({
    name: `demux8_${N}`,
    inputs: { d: N, sel: 3 },
    outputs: Object.fromEntries(Range.map(0, 8, i => [`q${i}`, N])) as Record<`q${Range<0, 8>}`, N>,
    connect(inp, out) {
      const createDemux4 = demux4(N);
      const m1 = createDemux4();
      const m2 = createDemux4();
      const m3 = demux2(N)();

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
  }, circuit);

  const demux16 = <N extends Num>(N: N) => createModule({
    name: `demux16_${N}`,
    inputs: { d: N, sel: 4 },
    outputs: Object.fromEntries(Range.map(0, 16, i => [`q${i}`, N])) as Record<`q${Range<0, 16>}`, N>,
    connect(inp, out) {
      const createDemux8 = demux8(N);
      const m1 = createDemux8();
      const m2 = createDemux8();
      const m3 = demux2(N)();

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
  }, circuit);

  const demux32 = <N extends Num>(N: N) => createModule({
    name: `demux32_${N}`,
    inputs: { d: N, sel: 5 },
    outputs: Object.fromEntries(Range.map(0, 32, i => [`q${i}`, N])) as Record<`q${Range<0, 32>}`, N>,
    connect(inp, out) {
      const createDemux16 = demux16(N);
      const m1 = createDemux16();
      const m2 = createDemux16();
      const m3 = demux2(N)();

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
  }, circuit);

  return {
    mux1: <N extends Num>(N: N) => mux1(N)(),
    mux2: <N extends Num>(N: N) => mux2(N)(),
    mux3: <N extends Num>(N: N) => mux3(N)(),
    mux4: <N extends Num>(N: N) => mux4(N)(),
    mux5: <N extends Num>(N: N) => mux5(N)(),
    demux2: <N extends Num>(N: N) => demux2(N)(),
    demux4: <N extends Num>(N: N) => demux4(N)(),
    demux8: <N extends Num>(N: N) => demux8(N)(),
    demux16: <N extends Num>(N: N) => demux16(N)(),
    demux32: <N extends Num>(N: N) => demux32(N)(),
    matchN: match,
    match1: match(1),
    match2: match(2),
    match3: match(3),
    match4: match(4),
    match5: match(5),
    match6: match(6),
    match7: match(7),
    match8: match(8),
    binaryDecoder2,
  };
};