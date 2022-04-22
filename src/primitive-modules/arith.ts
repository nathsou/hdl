import { Circuit, createModule, Multi } from "../core";
import { gen, genConnections, last } from "../utils";
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

  const adderN = <N extends Multi>(N: N) => createModule({
    name: `adder${N}`,
    inputs: { a: N, b: N, carry_in: 1 },
    outputs: { sum: N, carry_out: 1 },
    connect(inp, out) {
      const adders = gen(N, fullAdder);

      for (let i = 0; i < N; i++) {
        adders[i].in.carry_in = i === 0 ? inp.carry_in : adders[i - 1].out.carry_out;
        // @ts-ignore
        adders[i].in.a = inp.a[N - 1 - i];
        // @ts-ignore
        adders[i].in.b = inp.b[N - 1 - i];
      }

      // @ts-ignore
      out.sum = gen(N, i => adders[N - 1 - i].out.sum);
      out.carry_out = last(adders).out.carry_out;
    },
  }, circ);

  const adderSubtractorN = <N extends Multi>(N: N) => createModule({
    name: `adder_subtractor${N}`,
    inputs: { a: N, b: N, subtract: 1 },
    outputs: { sum: N, carry_out: 1 },
    connect(inp, out) {
      const adder = adderN(N)();
      const xors = gates.xorN(N);

      xors.in.a = genConnections(N, () => inp.subtract);
      xors.in.b = inp.b;

      adder.in.carry_in = inp.subtract;
      adder.in.a = inp.a;
      adder.in.b = xors.out.q;

      out.sum = adder.out.sum;
      out.carry_out = adder.out.carry_out;
    },
  }, circ);

  return {
    halfAdder1: halfAdder,
    adder1: fullAdder,
    adder2: adderN(2),
    adder4: adderN(4),
    adder8: adderN(8),
    adder16: adderN(16),
    adderN: <N extends Multi>(N: N) => adderN(N)(),
    adderSubtractorN: <N extends Multi>(N: N) => adderSubtractorN(N)(),
  };
};