import { Connection, createModuleGroup, defineModule, IO, Nat, Width } from "../core";
import { Range, Tuple } from "../utils";
import { and, land, lor, not, or } from "./gates";


export const Mux2 = <N extends Nat>(N: N) => defineModule({
  name: `mux2_${N}`,
  inputs: { d0: N, d1: N, sel: 1 },
  outputs: { q: N },
  connect({ sel, d0, d1 }, out) {
    out.q = or(
      and(d0, IO.repeat(N, not(sel))),
      and(d1, IO.repeat(N, sel))
    );
  }
})();

export const Mux4 = <N extends Nat>(N: N) => defineModule({
  name: `mux4_${N}`,
  inputs: { d0: N, d1: N, d2: N, d3: N, sel: 2 },
  outputs: { q: N },
  connect({ sel, d0, d1, d2, d3 }, out) {
    const m1 = Mux2(N);
    const m2 = Mux2(N);
    const m3 = Mux2(N);

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
})();

export const Mux8 = <N extends Nat>(N: N) => defineModule({
  name: `mux8_${N}`,
  inputs: { d0: N, d1: N, d2: N, d3: N, d4: N, d5: N, d6: N, d7: N, sel: 3 },
  outputs: { q: N },
  connect({ sel, d0, d1, d2, d3, d4, d5, d6, d7 }, out) {
    const m1 = Mux4(N);
    const m2 = Mux4(N);
    const m3 = Mux2(N);

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
})();

export const Mux16 = <N extends Nat>(N: N) => defineModule({
  name: `mux16_${N}`,
  inputs: {
    d0: N, d1: N, d2: N, d3: N, d4: N, d5: N, d6: N, d7: N,
    d8: N, d9: N, d10: N, d11: N, d12: N, d13: N, d14: N, d15: N,
    sel: 4
  },
  outputs: { q: N },
  connect(inp, out) {
    const m1 = Mux8(N);
    const m2 = Mux8(N);
    const m3 = Mux2(N);

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
})();

export const Mux32 = <N extends Nat>(N: N) => defineModule({
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
    const m1 = Mux16(N);
    const m2 = Mux16(N);
    const m3 = Mux2(N);

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
})();

export const Demux2 = <N extends Nat>(N: N) => defineModule({
  name: `demux2_${N}`,
  inputs: { d: N, sel: 1 },
  outputs: { q0: N, q1: N },
  connect(inp, out) {
    out.q0 = and(inp.d, IO.repeat(N, not(inp.sel)));
    out.q1 = and(inp.d, IO.repeat(N, inp.sel));
  }
})();

export const Demux4 = <N extends Nat>(N: N) => defineModule({
  name: `demux4_${N}`,
  inputs: { d: N, sel: 2 },
  outputs: { q0: N, q1: N, q2: N, q3: N },
  connect(inp, out) {
    const m1 = Demux2(N);
    const m2 = Demux2(N);
    const m3 = Demux2(N);

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
})();

export const Demux8 = <N extends Nat>(N: N) => defineModule({
  name: `demux8_${N}`,
  inputs: { d: N, sel: 3 },
  outputs: Object.fromEntries(Range.map(0, 8, i => [`q${i}`, N])) as Record<`q${Range<0, 8>}`, N>,
  connect(inp, out) {
    const m1 = Demux4(N);
    const m2 = Demux4(N);
    const m3 = Demux2(N);

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
})();

export const Demux16 = <N extends Nat>(N: N) => defineModule({
  name: `demux16_${N}`,
  inputs: { d: N, sel: 4 },
  outputs: Object.fromEntries(Range.map(0, 16, i => [`q${i}`, N])) as Record<`q${Range<0, 16>}`, N>,
  connect(inp, out) {
    const m1 = Demux8(N);
    const m2 = Demux8(N);
    const m3 = Demux2(N);

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
})();

export const Demux32 = <N extends Nat>(N: N) => defineModule({
  name: `demux32_${N}`,
  inputs: { d: N, sel: 5 },
  outputs: Object.fromEntries(Range.map(0, 32, i => [`q${i}`, N])) as Record<`q${Range<0, 32>}`, N>,
  connect(inp, out) {
    const m1 = Demux16(N);
    const m2 = Demux16(N);
    const m3 = Demux2(N);

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
})();

type Pow2 = { 1: 2, 2: 4, 3: 8, 4: 16, 5: 32, 6: 64, 7: 128 } & Record<number, number>;
type Log2 = { 2: 1, 4: 2, 8: 3, 16: 4, 32: 5, 64: 6, 128: 7 };

type Cases<Len extends keyof Pow2, N extends Nat> = Record<Range<0, Pow2[Len]>, IO<N>>;
type CasesWithDefault<Len extends keyof Pow2, N extends Nat> = Partial<Cases<Len, N>> & { _: IO<N> };
const matchAny = <
  N extends Nat,
  T extends IO<Nat>,
  C extends Cases<Width<T>, N> | CasesWithDefault<Width<T>, N>
>(value: T, cases: C): C[keyof C] => {
  const firstCase = Object.values(cases)[0];
  const N = Array.isArray(firstCase) ? firstCase.length : 1;

  return createModuleGroup(`match${N}${IO.width(value)}`, () => {
    const ors: Tuple<Connection, N>[] = [];
    const valueTuple = IO.asArray(value);
    const isExhaustive = !Object.keys(cases).some(key => key === '_');
    const isMatchedOrs: Connection[] = [];

    const casesExceptDefault = Object.entries(cases).filter(([key]) => key !== '_');

    for (const [n, c] of casesExceptDefault) {
      const connectionTuple = IO.asArray(c);
      const bits = Tuple.bin(Number(n), valueTuple.length);
      const selected = land(...bits.map((b, i) => b === 1 ? valueTuple[i] : not(valueTuple[i])));
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

    return IO.gen(N, i => lor(...ors.map(o => o[i]))) as C[keyof C];
  });
};

export const match = <
  N extends Width<C[keyof C]>,
  T extends IO<Nat>,
  C extends Cases<Width<T>, Nat>,
  >(value: T, cases: C): C[keyof C] => matchAny<N, T, C>(value, cases);

export const matchWithDefault = <
  T extends IO<Nat>,
  C extends CasesWithDefault<Width<T>, Nat>,
  >(value: T, cases: C) => matchAny(value, cases);

export const decoder = <N extends 2 | 4 | 8 | 16 | 32>(N: N, sel: IO<Log2[N]>): IO<N> => {
  const d = defineModule({
    name: `decoder_sim_${N}`,
    inputs: { sel: IO.width(sel) as Log2[N] },
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