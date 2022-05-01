import { Circuit, Connection, createModule, IO, Multi, Num, State } from "../core";
import { last, Range, Tuple } from "../utils";
import { GateModules } from "./gates";
import { MetaModules } from "./meta";
import { MultiplexerModules } from "./mux";

export type ArithmeticModules = ReturnType<typeof createArith>;

export const createArith = (
  circ: Circuit,
  { and, or, nor, not, xor, xnor, logicalAnd, logicalOr, logicalNot }: GateModules,
  mux: MultiplexerModules,
  meta: MetaModules
) => {
  const halfAdder = createModule({
    name: 'half_adder',
    inputs: { a: 1, b: 1 },
    outputs: { sum: 1, carry: 1 },
    connect(inp, out) {
      out.sum = xor<1>(inp.a, inp.b);
      out.carry = and<1>(inp.a, inp.b);
    },
  }, circ);

  const fullAdder = createModule({
    name: 'full_adder',
    inputs: { a: 1, b: 1, carry_in: 1 },
    outputs: { sum: 1, carry_out: 1 },
    connect(inp, out) {
      const xor1 = xor<1>(inp.a, inp.b);

      // sum
      out.sum = xor<1>(xor1, inp.carry_in);

      // carry
      out.carry_out = or<1>(
        and<1>(inp.carry_in, xor1),
        and<1>(inp.a, inp.b)
      );
    },
  }, circ);

  const adder = <N extends Multi>(N: N) => createModule({
    name: `adder${N}`,
    inputs: { a: N, b: N, carry_in: 1 },
    outputs: { sum: N, carry_out: 1 },
    connect(inp, out) {
      const adders = Tuple.gen(N, fullAdder);

      for (let i = 0; i < N; i++) {
        adders[i].in.carry_in = i === 0 ? inp.carry_in : adders[i - 1].out.carry_out;
        adders[i].in.a = inp.a[N - 1 - i];
        adders[i].in.b = inp.b[N - 1 - i];
      }

      out.sum = IO.gen(N, i => adders[N - 1 - i].out.sum);
      out.carry_out = last(adders).out.carry_out;
    },
  }, circ);

  const adderSubtractor = <N extends Multi>(N: N) => createModule({
    name: `adder_subtractor${N}`,
    inputs: { a: N, b: N, subtract: 1 },
    outputs: { sum: N, carry_out: 1 },
    connect(inp, out) {
      const sum = adder(N)();
      sum.in.carry_in = inp.subtract;
      sum.in.a = inp.a;
      sum.in.b = xor(IO.repeat(N, inp.subtract), inp.b);

      out.sum = sum.out.sum;
      out.carry_out = sum.out.carry_out;
    },
  }, circ);

  const isEqualConst = <N extends Num>(cnst: Tuple<State, N>, d: IO<N>): Connection => {
    return logicalAnd(...IO.asArray(cnst).map((state, i) => state === 1 ? IO.at(d, i) : logicalNot(IO.at(d, i))));
  };

  const isEqual = <N extends Num>(a: IO<N>, b: IO<N>): Connection => {
    return logicalAnd(...IO.asArray(xnor<N>(a, b)));
  };

  const add = <N extends Multi>(a: IO<N>, b: IO<N>): IO<N> => {
    const sum = adder(a.length as N)();

    sum.in.a = a;
    sum.in.b = b;
    sum.in.carry_in = 0;

    return sum.out.sum;
  };

  const subtract = <N extends Multi>(a: IO<N>, b: IO<N>): IO<N> => {
    const subtractor = adderSubtractor(a.length as N)();

    subtractor.in.subtract = 1;
    subtractor.in.a = a;
    subtractor.in.b = b;

    return subtractor.out.sum;
  };

  const log2 = { 2: 4, 4: 2, 8: 3, 16: 4, 32: 5 } as const;
  type Log2 = typeof log2;

  const rightShifer = <N extends keyof Log2>(N: N) => createModule({
    name: `right_shifter${N}`,
    inputs: { d: N, amount: log2[N] },
    outputs: { q: N },
    connect({ d, amount }, out) {
      const muxes = Tuple.gen(N, () => mux[`mux${N}`](1));

      IO.forward({ sel: amount }, muxes);

      Range.iter(0, N, n => {
        Range.iter(0, N, stage => {
          /// @ts-ignore
          muxes[stage].in[`d${n}`] = n > stage ? 0 : d[stage - n];
        });
      });

      out.q = IO.gen(N, n => muxes[n].out.q);
    }
  }, circ);

  const leftShifer = <N extends keyof Log2>(N: N) => createModule({
    name: `left_shifter${N}`,
    inputs: { d: N, amount: log2[N] },
    outputs: { q: N },
    connect({ d, amount }, out) {
      const muxes = Tuple.gen(N, () => mux[`mux${N}`](1));

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
  }, circ);

  const shiftLeft = <N extends keyof Log2>(d: IO<N>, amount: IO<Log2[N]>): IO<N> => {
    const N = IO.width(d);
    const shifter = leftShifer(N)();
    shifter.in.d = d;
    shifter.in.amount = amount;

    return shifter.out.q;
  };

  const shiftRight = <N extends keyof Log2>(d: IO<N>, amount: IO<Log2[N]>): IO<N> => {
    const N = IO.width(d);
    const shifter = rightShifer(N)();
    shifter.in.d = d;
    shifter.in.amount = amount;

    return shifter.out.q;
  };

  const comparator1 = createModule({
    name: 'comparator1',
    inputs: { a: 1, b: 1 },
    outputs: { lss: 1, equ: 1, gtr: 1 },
    connect({ a, b }, out) {
      out.lss = and<1>(not<1>(a), b);
      out.equ = xnor<1>(a, b);
      out.gtr = and<1>(a, not<1>(b));
    }
  }, circ);

  // amplitude comparator with cascade
  const comparator4 = createModule({
    name: 'comparator4',
    inputs: { a: 4, b: 4, cascaded_lss: 1, cascaded_equ: 1, cascaded_gtr: 1 },
    outputs: { lss: 1, equ: 1, gtr: 1 },
    connect({ a, b, cascaded_lss, cascaded_equ, cascaded_gtr }, out) {
      const [a3, a2, a1, a0] = a;
      const [notb3, notb2, notb1, notb0] = not<4>(b);
      const [eq3, eq2, eq1, eq0] = xnor<4>(a, b);

      const equ = logicalAnd(eq3, eq2, eq1, eq0);

      const gtr = logicalOr(
        logicalAnd(a3, notb3),
        logicalAnd(a2, notb2, eq3),
        logicalAnd(a1, notb1, eq3, eq2),
        logicalAnd(a0, notb0, eq3, eq2, eq1)
      );

      const lss = nor<1>(gtr, equ);

      out.lss = or<1>(and<1>(equ, cascaded_lss), lss);
      out.equ = and<1>(cascaded_equ, equ);
      out.gtr = or<1>(and<1>(equ, cascaded_gtr), gtr);
    }
  }, circ);

  const comparator8 = createModule({
    name: 'comparator8',
    inputs: { a: 8, b: 8, cascaded_lss: 1, cascaded_equ: 1, cascaded_gtr: 1 },
    outputs: { lss: 1, equ: 1, gtr: 1 },
    connect({ a, b, cascaded_lss, cascaded_equ, cascaded_gtr }, out) {
      const lsb = comparator4();
      const msb = comparator4();

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
  }, circ);

  const comparator16 = createModule({
    name: 'comparator16',
    inputs: { a: 16, b: 16, cascaded_lss: 1, cascaded_equ: 1, cascaded_gtr: 1 },
    outputs: { lss: 1, equ: 1, gtr: 1 },
    connect({ a, b, cascaded_lss, cascaded_equ, cascaded_gtr }, out) {
      const lsb = comparator8();
      const msb = comparator8();

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
  }, circ);

  const comparator32 = createModule({
    name: 'comparator32',
    inputs: { a: 32, b: 32, cascaded_lss: 1, cascaded_equ: 1, cascaded_gtr: 1 },
    outputs: { lss: 1, equ: 1, gtr: 1 },
    connect({ a, b, cascaded_lss, cascaded_equ, cascaded_gtr }, out) {
      const lsb = comparator16();
      const msb = comparator16();

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
  }, circ);

  const compare8 = (a: IO<8>, b: IO<8>) => {
    const comp = comparator8();
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

  return {
    halfAdder1: halfAdder,
    adder: <N extends Multi>(N: N) => adder(N)(),
    adderSubtractor: <N extends Multi>(N: N) => adderSubtractor(N)(),
    add,
    subtract,
    isEqual,
    isEqualConst,
    rightShifter: <N extends keyof Log2>(N: N) => rightShifer(N)(),
    leftShifer: <N extends keyof Log2>(N: N) => leftShifer(N)(),
    shiftLeft,
    shiftRight,
    comparator1,
    comparator4,
    comparator8,
    comparator16,
    comparator32,
    compare8,
  };
};