import { Connection, defineModule, IO, Multi, Nat, State, successor } from "../core";
import { last, Range, Tuple } from "../utils";
import { and, land, lnot, lor, nor, not, or, xnor, xor } from "./gates";
import * as mux from './mux';

const log2 = { 2: 4, 4: 2, 8: 3, 16: 4, 32: 5 } as const;
type Log2 = typeof log2;

export const HalfAdder1 = defineModule({
  name: 'half_adder1',
  inputs: { a: 1, b: 1 },
  outputs: { sum: 1, carry: 1 },
  connect(inp, out) {
    out.sum = xor(inp.a, inp.b);
    out.carry = and(inp.a, inp.b);
  },
});

export const FullAdder1 = defineModule({
  name: 'full_adder1',
  inputs: { a: 1, b: 1, carryIn: 1 },
  outputs: { sum: 1, carryOut: 1 },
  connect(inp, out) {
    const xor1 = xor(inp.a, inp.b);

    // sum
    out.sum = xor(xor1, inp.carryIn);

    // carry
    out.carryOut = or(
      and(inp.carryIn, xor1),
      and(inp.a, inp.b)
    );
  },
});

export const Adder = <N extends Multi>(N: N) => defineModule({
  name: `adder${N}`,
  inputs: { a: N, b: N, carryIn: 1 },
  outputs: { sum: N, carryOut: 1 },
  connect(inp, out) {
    const adders = Tuple.gen(N, FullAdder1);

    for (let i = 0; i < N; i++) {
      adders[i].in.carryIn = i === 0 ? inp.carryIn : adders[i - 1].out.carryOut;
      adders[i].in.a = inp.a[N - 1 - i];
      adders[i].in.b = inp.b[N - 1 - i];
    }

    out.sum = IO.gen(N, i => adders[N - 1 - i].out.sum);
    out.carryOut = last(adders).out.carryOut;
  },
})();

export const AdderSubtractor = <N extends Multi>(N: N) => defineModule({
  name: `adder_subtractor${N}`,
  inputs: { a: N, b: N, subtract: 1, carryIn: 1 },
  outputs: { sum: N, carryOut: 1 },
  connect({ a, b, subtract, carryIn }) {
    const sum = Adder(N);
    sum.in.carryIn = lor(land(lnot(subtract), carryIn), land(subtract, lnot(carryIn)));
    sum.in.a = a;
    sum.in.b = xor(IO.repeat(N, subtract), b);

    return {
      sum: sum.out.sum,
      carryOut: sum.out.carryOut
    };
  },
})();

export const RightBarrelShifter = <N extends keyof Log2>(N: N) => defineModule({
  name: `right_barrel_shifter${N}`,
  inputs: { d: N, amount: log2[N] },
  outputs: { q: N },
  connect({ d, amount }, out) {
    const muxes = Tuple.gen(N, () => mux[`Mux${N}`](1));

    IO.forward({ sel: amount }, muxes);

    Range.iter(0, N, n => {
      Range.iter(0, N, stage => {
        /// @ts-ignore
        muxes[stage].in[`d${n}`] = n > stage ? 0 : d[stage - n];
      });
    });

    out.q = IO.gen(N, n => muxes[n].out.q);
  }
})();

export const LeftBarrelShifter = <N extends keyof Log2>(N: N) => defineModule({
  name: `left_barrel_shifter${N}`,
  inputs: { d: N, amount: log2[N] },
  outputs: { q: N },
  connect({ d, amount }, out) {
    const muxes = Tuple.gen(N, () => mux[`Mux${N}`](1));

    IO.forward({ sel: amount }, muxes);

    // [d0, d1, d2, d3]
    // [d1, d2, d3, 0 ]
    // [d2, d3, 0,  0 ]
    // [d3, 0,  0,  0 ]

    Range.iter(0, N, stage => {
      Range.iter(0, N, n => {
        /// @ts-ignore
        muxes[stage].in[`d${n}`] = n + stage < N ? d[n + stage] : 0;
      });
    });

    out.q = IO.gen(N, n => muxes[n].out.q);
  }
})();

export const BidirectionalShifter = <N extends Multi>(N: N) => defineModule({
  name: 'bidirectional_shifter',
  inputs: { d: N, dir: 1, carryIn: 1 },
  outputs: { q: N, carryOut: 1 },
  connect({ d, dir, carryIn }) {
    const left = IO.slice(IO.append(d, carryIn), 1, successor(N)) as IO<N>;
    const right = IO.slice(IO.prepend(d, carryIn), 0, N) as IO<N>;

    return {
      q: mux.match(dir, {
        0: left,
        1: right,
      }),
      carryOut: mux.match(dir, {
        0: d[0],
        1: d[N as number],
      }),
    };
  },
})();

export const Comparator1 = defineModule({
  name: 'comparator1',
  inputs: { a: 1, b: 1 },
  outputs: { lss: 1, equ: 1, gtr: 1 },
  connect({ a, b }, out) {
    out.lss = and(not(a), b);
    out.equ = xnor(a, b);
    out.gtr = and(a, not(b));
  }
});

// amplitude comparator with cascade
export const Comparator4 = defineModule({
  name: 'comparator4',
  inputs: { a: 4, b: 4, cascaded_lss: 1, cascaded_equ: 1, cascaded_gtr: 1 },
  outputs: { lss: 1, equ: 1, gtr: 1 },
  connect({ a, b, cascaded_lss, cascaded_equ, cascaded_gtr }, out) {
    const [a3, a2, a1, a0] = a;
    const [notb3, notb2, notb1, notb0] = not(b);
    const [eq3, eq2, eq1, eq0] = xnor(a, b);

    const equ = land(eq3, eq2, eq1, eq0);

    const gtr = lor(
      land(a3, notb3),
      land(a2, notb2, eq3),
      land(a1, notb1, eq3, eq2),
      land(a0, notb0, eq3, eq2, eq1)
    );

    const lss = nor(gtr, equ);

    out.lss = or(and(equ, cascaded_lss), lss);
    out.equ = and(cascaded_equ, equ);
    out.gtr = or(and(equ, cascaded_gtr), gtr);
  }
});

export const Comparator8 = defineModule({
  name: 'comparator8',
  inputs: { a: 8, b: 8, cascaded_lss: 1, cascaded_equ: 1, cascaded_gtr: 1 },
  outputs: { lss: 1, equ: 1, gtr: 1 },
  connect({ a, b, cascaded_lss, cascaded_equ, cascaded_gtr }, out) {
    const lsb = Comparator4();
    const msb = Comparator4();

    lsb.in.a = Tuple.low(4, a);
    lsb.in.b = Tuple.low(4, b);
    lsb.in.cascaded_lss = cascaded_lss;
    lsb.in.cascaded_equ = cascaded_equ;
    lsb.in.cascaded_gtr = cascaded_gtr;

    msb.in.a = Tuple.high(4, a);
    msb.in.b = Tuple.high(4, b);
    msb.in.cascaded_lss = lsb.out.lss;
    msb.in.cascaded_equ = lsb.out.equ;
    msb.in.cascaded_gtr = lsb.out.gtr;

    out.lss = msb.out.lss;
    out.equ = msb.out.equ;
    out.gtr = msb.out.gtr;
  }
});

export const Comparator16 = defineModule({
  name: 'comparator16',
  inputs: { a: 16, b: 16, cascaded_lss: 1, cascaded_equ: 1, cascaded_gtr: 1 },
  outputs: { lss: 1, equ: 1, gtr: 1 },
  connect({ a, b, cascaded_lss, cascaded_equ, cascaded_gtr }, out) {
    const lsb = Comparator8();
    const msb = Comparator8();

    lsb.in.a = Tuple.low(8, a);
    lsb.in.b = Tuple.low(8, b);
    lsb.in.cascaded_lss = cascaded_lss;
    lsb.in.cascaded_equ = cascaded_equ;
    lsb.in.cascaded_gtr = cascaded_gtr;

    msb.in.a = Tuple.high(8, a);
    msb.in.b = Tuple.high(8, b);
    msb.in.cascaded_lss = lsb.out.lss;
    msb.in.cascaded_equ = lsb.out.equ;
    msb.in.cascaded_gtr = lsb.out.gtr;

    out.lss = msb.out.lss;
    out.equ = msb.out.equ;
    out.gtr = msb.out.gtr;
  }
});

export const Comparator32 = defineModule({
  name: 'comparator32',
  inputs: { a: 32, b: 32, cascaded_lss: 1, cascaded_equ: 1, cascaded_gtr: 1 },
  outputs: { lss: 1, equ: 1, gtr: 1 },
  connect({ a, b, cascaded_lss, cascaded_equ, cascaded_gtr }, out) {
    const lsb = Comparator16();
    const msb = Comparator16();

    lsb.in.a = Tuple.low(16, a);
    lsb.in.b = Tuple.low(16, b);
    lsb.in.cascaded_lss = cascaded_lss;
    lsb.in.cascaded_equ = cascaded_equ;
    lsb.in.cascaded_gtr = cascaded_gtr;

    msb.in.a = Tuple.high(16, a);
    msb.in.b = Tuple.high(16, b);
    msb.in.cascaded_lss = lsb.out.lss;
    msb.in.cascaded_equ = lsb.out.equ;
    msb.in.cascaded_gtr = lsb.out.gtr;

    out.lss = msb.out.lss;
    out.equ = msb.out.equ;
    out.gtr = msb.out.gtr;
  }
});

export const compare8 = (a: IO<8>, b: IO<8>) => {
  const comp = Comparator8();
  comp.in.a = a;
  comp.in.b = b;
  comp.in.cascaded_lss = 0;
  comp.in.cascaded_equ = 1;
  comp.in.cascaded_gtr = 0;

  return {
    lss: comp.out.lss,
    equ: comp.out.equ,
    gtr: comp.out.gtr,
  };
};

// shorthands

export const isEqualConst = <N extends Nat>(cnst: Tuple<State, N>, d: IO<N>): Connection => {
  return land(...IO.asArray(cnst).map((state, i) => state === 1 ? IO.at(d, i) : lnot(IO.at(d, i))));
};

export const isEqual = <N extends Nat>(a: IO<N>, b: IO<N>): Connection => {
  return land(...IO.asArray(xnor(a, b)));
};

export const add = <N extends Multi>(a: IO<N>, b: IO<N>, carryIn: Connection = State.zero): IO<N> => {
  const sum = Adder(a.length as N);

  sum.in.a = a;
  sum.in.b = b;
  sum.in.carryIn = carryIn;

  return sum.out.sum;
};

export const subtract = <N extends Multi>(a: IO<N>, b: IO<N>): IO<N> => {
  const subtractor = AdderSubtractor(a.length as N);

  subtractor.in.subtract = 1;
  subtractor.in.a = a;
  subtractor.in.b = b;

  return subtractor.out.sum;
};

export const shiftLeft = <N extends keyof Log2>(d: IO<N>, amount: IO<Log2[N]>): IO<N> => {
  const N = IO.width(d) as N;
  const shifter = LeftBarrelShifter(N);
  shifter.in.d = d;
  shifter.in.amount = amount;

  return shifter.out.q;
};

export const shiftRight = <N extends keyof Log2>(d: IO<N>, amount: IO<Log2[N]>): IO<N> => {
  const N = IO.width(d) as N;
  const shifter = RightBarrelShifter(N);
  shifter.in.d = d;
  shifter.in.amount = amount;

  return shifter.out.q;
};
