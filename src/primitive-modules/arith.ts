import { Circuit, Connection, createModule, Multi, MultiIO } from "../core";
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

      out.sum = Connection.gen(N, i => adders[N - 1 - i].out.sum);
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

      xors.in.a = Connection.gen(N, () => inp.subtract);
      xors.in.b = inp.b;

      sum.in.carry_in = inp.subtract;
      sum.in.a = inp.a;
      sum.in.b = xors.out.q;

      out.sum = sum.out.sum;
      out.carry_out = sum.out.carry_out;
    },
  }, circ);

  const add = <N extends Multi>(a: MultiIO<N, Connection>, b: MultiIO<N, Connection>): MultiIO<N, Connection> => {
    const sum = adder(a.length as N)();

    sum.in.a = a;
    sum.in.b = b;
    sum.in.carry_in = 0;

    return sum.out.sum;
  };

  const subtract = <N extends Multi>(a: MultiIO<N, Connection>, b: MultiIO<N, Connection>): MultiIO<N, Connection> => {
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
  };
};