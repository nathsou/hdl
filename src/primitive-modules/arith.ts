import { Circuit, createModule, width } from "../core";
import { gen, last } from "../utils";
import { Gates } from "./gates";
import { extendN, Multi } from "./meta";

export const createArith = (circ: Circuit, gates: Gates) => {
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
      const and1 = gates.and();
      const xor1 = gates.xor();

      and1.in.a = inp.a;
      and1.in.b = inp.b;
      xor1.in.a = inp.a;
      xor1.in.b = inp.b;

      out.sum = xor1.out.q;
      out.carry = and1.out.q;
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
      const xor1 = gates.xor();
      const xor2 = gates.xor();
      const and1 = gates.and();
      const and2 = gates.and();
      const or1 = gates.or();

      // sum
      xor1.in.a = inp.a;
      xor1.in.b = inp.b;
      xor2.in.a = xor1.out.q;
      xor2.in.b = inp.carry_in;
      out.sum = xor2.out.q;

      // carry
      and1.in.a = inp.carry_in;
      and1.in.b = xor1.out.q;
      and2.in.a = inp.a;
      and2.in.b = inp.b;
      or1.in.a = and1.out.q;
      or1.in.b = and2.out.q;
      out.carry_out = or1.out.q;
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
    name: 'adder_subtractor8',
    inputs: { a: N, b: N, subtract: width[1] },
    outputs: { sum: N, carry_out: width[1] },
    connect(inp, out) {
      const adder = adderN(N)();
      const xors = extendN(circ)(N, gates.xor, ['a', 'b'], ['q'], `xor${N}`)();

      /// @ts-ignore
      xors.in.a = gen(N, () => inp.subtract);
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