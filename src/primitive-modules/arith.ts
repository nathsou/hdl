import { Circuit, createModule, Multi, IO, Num, State } from "../core";
import { last, Tuple } from "../utils";
import { GateModules } from "./gates";

export type ArithmeticModules = ReturnType<typeof createArith>;

export const createArith = (circ: Circuit, gates: GateModules) => {
  // a  b  c  s
  // 0  0  0  0
  // 0  1  0  1
  // 1  0  0  1
  // 1  1  1  0

  const halfAdder = createModule({
    name: 'half_adder',
    inputs: { a: 1, b: 1 },
    outputs: { sum: 1, carry: 1 },
    connect(inp, out) {
      out.sum = gates.xor(inp.a, inp.b);
      out.carry = gates.and(inp.a, inp.b);
    },
  }, circ);

  // ci a  b  co s
  // 0  0  0  0  0
  // 0  0  1  0  1
  // 0  1  0  0  1
  // 0  1  1  1  0
  // 1  0  0  0  1
  // 1  0  1  1  0
  // 1  1  0  1  0
  // 1  1  1  1  1

  const fullAdder = createModule({
    name: 'full_adder',
    inputs: { a: 1, b: 1, carry_in: 1 },
    outputs: { sum: 1, carry_out: 1 },
    connect(inp, out) {
      const xor1 = gates.xor(inp.a, inp.b);

      // sum
      out.sum = gates.xor(xor1, inp.carry_in);

      // carry
      out.carry_out = gates.or(
        gates.and(inp.carry_in, xor1),
        gates.and(inp.a, inp.b)
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
      const xors = gates.xorN(N);

      xors.in.a = IO.gen(N, () => inp.subtract);
      xors.in.b = inp.b;

      sum.in.carry_in = inp.subtract;
      sum.in.a = inp.a;
      sum.in.b = xors.out.q;

      out.sum = sum.out.sum;
      out.carry_out = sum.out.carry_out;
    },
  }, circ);

  const equalsConst = <N extends Num>(c: Tuple<State, N>) => createModule({
    name: `equals_const_${c.join('')}`,
    inputs: { d: c.length as N },
    outputs: { q: 1 },
    connect({ d }, out) {
      out.q = gates.and(...c.map((state, i) => state === 1 ? IO.at(d, i) : gates.not(IO.at(d, i))));
    },
  }, circ);

  const isEqual = <N extends Num>(N: N) => createModule({
    name: `is_equal_${N}`,
    inputs: { a: N, b: N },
    outputs: { q: 1 },
    connect({ a, b }, out) {
      const eq = gates.xnorN(N);
      eq.in.a = a;
      eq.in.b = b;

      out.q = gates.and(...IO.asArray(eq.out.q));
    }
  }, circ);

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
    equalsConst,
    isEqual: <N extends Multi>(N: N) => isEqual(N)(),
  };
};