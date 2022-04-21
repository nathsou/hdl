import { Circuit, createModule, createPrimitiveModule, State, width } from "../core";
import { forwardInputs, gen, genConnections } from "../utils";
import { ArithmeticModules } from "./arith";
import { GateModules } from "./gates";
import { MemoryModules } from "./mem";
import { Multi } from "./meta";

export const createRegisters = (
  circ: Circuit, { and }: GateModules,
  { leaderFollowerJKFlipFlop: jkFF }: MemoryModules,
  { adderN }: ArithmeticModules
) => {
  const counterNJKs = <N extends Multi>(N: N) => createModule({
    name: `counter${N}`,
    inputs: { count_enable: width[1], clk: width[1] },
    outputs: { q: N },
    connect(inp, out) {
      const jks = gen(N, jkFF);

      forwardInputs({ clk: inp.clk }, jks);

      jks[0].in.j = inp.count_enable;
      jks[0].in.k = inp.count_enable;

      let andChain = jks[0].out.q;

      for (let i = 1; i < N; i++) {
        jks[i].in.j = andChain;
        jks[i].in.k = andChain;

        if (i !== N - 1) {
          andChain = and(andChain, jks[i].out.q);
        }
      }

      out.q = genConnections(N, i => jks[N - 1 - i].out.q);
    },
  }, circ);

  const counterN = <N extends Multi>(N: N) => createModule({
    name: `counter${N}`,
    inputs: { count_enable: width[1], clk: width[1] },
    outputs: { q: N },
    connect(inp, out) {
      const adder = adderN(N);
      const reg = regN(N)();

      reg.in.clk = inp.clk;
      reg.in.load = inp.count_enable;
      adder.in.carry_in = inp.count_enable;
      adder.in.a = reg.out.q;
      adder.in.b = genConnections(N, () => 0);
      reg.in.d = adder.out.sum;

      out.q = reg.out.q;
    },
  }, circ);

  const counterNSim = <N extends Multi>(N: N) => createPrimitiveModule({
    name: `counter${N}`,
    inputs: { count_enable: width[1], clk: width[1] },
    outputs: { q: N },
    state: { bits: genConnections<State, N>(N, () => 0) },
    simulate(inp, out, { bits }) {
      if (inp.count_enable && inp.clk) {
        let carry = 1;
        for (let i = N - 1; i >= 0; i--) {
          const sum = carry + bits[i];
          if (sum === 0) {
            carry = 0;
            bits[i] = 0;
          } else if (sum === 1) {
            carry = 0;
            bits[i] = 1;
          } else {
            carry = 1;
            bits[i] = 0;
          }
        }
      }

      out.q = bits;
    },
  }, circ);

  const regN = <N extends Multi>(N: N) => createPrimitiveModule({
    name: `reg${N}`,
    inputs: { d: N, load: width[1], clk: width[1] },
    outputs: { q: N },
    state: { data: genConnections<State, N>(N, () => 0), last_clk: 0 },
    simulate(inp, out, state) {
      const rising = inp.clk && !state.last_clk;

      if (rising && inp.load) {
        state.data = inp.d;
        out.q = state.data;
      }

      state.last_clk = inp.clk;
    },
  }, circ);

  return {
    counterN: <N extends Multi>(N: N) => counterN(N)(),
    counterNJKs: <N extends Multi>(N: N) => counterNJKs(N)(),
    counterNSim: <N extends Multi>(N: N) => counterNSim(N)(),
    reg2: regN(2),
    reg4: regN(4),
    reg8: regN(8),
    reg16: regN(16),
    regN: <N extends Multi>(N: N) => regN(N)(),
  };
};