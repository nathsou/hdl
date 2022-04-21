import { Circuit, createModule, width } from "../core";
import { gen, genConnections, last } from "../utils";
import { GateModules } from "./gates";
import { extendN, Multi } from "./meta";

export type ArithmeticModules = ReturnType<typeof createArith>;

export const createArith = (circ: Circuit, gates: GateModules) => {
  // a  b  c  s
  // 0  0  0  0
  // 0  1  0  1
  // 1  0  0  1
  // 1  1  1  0

  const halfAdder = createModule({
    name: 'half_adder',
    inputs: { a: width[1], b: width[1] },
    outputs: { sum: width[1], carry: width[1] },
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
    inputs: { a: width[1], b: width[1], carry_in: width[1] },
    outputs: { sum: width[1], carry_out: width[1] },
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
    inputs: { a: N, b: N, carry_in: width[1] },
    outputs: { sum: N, carry_out: width[1] },
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
    inputs: { a: N, b: N, subtract: width[1] },
    outputs: { sum: N, carry_out: width[1] },
    connect(inp, out) {
      const adder = adderN(N)();
      const xors = extendN(circ)(N, gates.xor_, ['a', 'b'], ['q'], `xor${N}`)();

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
    halfAdder,
    fullAdder,
    adderN,
    adderSubtractorN,
  };
};