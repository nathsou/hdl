import { Circuit, Connection, createModule, IO, Multi, Num, State } from "../core";
import { assert, last, Range, Tuple } from "../utils";
import { GateModules } from "./gates";
import { MultiplexerModules } from "./mux";

export type ArithmeticModules = ReturnType<typeof createArith>;

export const createArith = (circ: Circuit, gates: GateModules, mux: MultiplexerModules) => {
  const halfAdder = createModule({
    name: 'half_adder',
    inputs: { a: 1, b: 1 },
    outputs: { sum: 1, carry: 1 },
    connect(inp, out) {
      out.sum = gates.xor<1>(inp.a, inp.b);
      out.carry = gates.and<1>(inp.a, inp.b);
    },
  }, circ);

  const fullAdder = createModule({
    name: 'full_adder',
    inputs: { a: 1, b: 1, carry_in: 1 },
    outputs: { sum: 1, carry_out: 1 },
    connect(inp, out) {
      const xor1 = gates.xor<1>(inp.a, inp.b);

      // sum
      out.sum = gates.xor<1>(xor1, inp.carry_in);

      // carry
      out.carry_out = gates.or<1>(
        gates.and<1>(inp.carry_in, xor1),
        gates.and<1>(inp.a, inp.b)
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
      sum.in.b = gates.xor(IO.repeat(N, inp.subtract), inp.b);

      out.sum = sum.out.sum;
      out.carry_out = sum.out.carry_out;
    },
  }, circ);

  const isEqualConst = <N extends Num>(cnst: Tuple<State, N>, d: IO<N>): Connection => {
    return gates.logicalAnd(...IO.asArray(cnst).map((state, i) => state === 1 ? IO.at(d, i) : gates.logicalNot(IO.at(d, i))));
  };

  const isEqual = <N extends Num>(a: IO<N>, b: IO<N>): Connection => {
    return gates.logicalAnd(...IO.asArray(gates.xnor<N>(a, b)));
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

  const log2 = { 4: 2, 8: 3, 16: 4, 32: 5 } as const;
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

  return {
    halfAdder1: halfAdder,
    adder1: fullAdder,
    adder2: adder(2),
    adder4: adder(4),
    adder8: adder(8),
    adder16: adder(16),
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
  };
};