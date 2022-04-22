import { Circuit, createModule, createPrimitiveModule, State, Multi, Connection } from "../core";
import { Tuple } from "../utils";
import { ArithmeticModules } from "./arith";
import { GateModules } from "./gates";
import { MemoryModules } from "./mem";

export const createRegisters = (
  circ: Circuit, { and }: GateModules,
  { leaderFollowerJKFlipFlop: jkFF }: MemoryModules,
  { adderN }: ArithmeticModules
) => {
  const jkCounterN = <N extends Multi>(N: N) => createModule({
    name: `jk_counter${N}`,
    inputs: { count_enable: 1, clk: 1 },
    outputs: { q: N },
    connect(inp, out) {
      const jks = Tuple.gen(N, jkFF);

      Connection.forward({ clk: inp.clk }, jks);

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

      out.q = Connection.gen(N, i => jks[N - 1 - i].out.q);
    },
  }, circ);

  const counterN = <N extends Multi>(N: N) => createModule({
    name: `counter${N}`,
    inputs: { count_enable: 1, clk: 1 },
    outputs: { q: N },
    connect(inp, out) {
      const adder = adderN(N);
      const reg = regN(N)();

      reg.in.clk = inp.clk;
      reg.in.load = inp.count_enable;
      adder.in.carry_in = inp.count_enable;
      adder.in.a = reg.out.q;
      adder.in.b = Connection.gen(N, () => 0);
      reg.in.d = adder.out.sum;

      out.q = reg.out.q;
    },
  }, circ);

  const counterSimN = <N extends Multi>(N: N) => createPrimitiveModule({
    name: `counter_sim${N}`,
    inputs: { count_enable: 1, clk: 1 },
    outputs: { q: N },
    state: { bits: Connection.gen<State, N>(N, () => 0), last_clk: 0 },
    simulate(inp, out, state) {
      const rising = state.last_clk === 0 && inp.clk;
      if (inp.count_enable && rising) {
        for (let i = N - 1; i >= 0; i--) {
          const prev = state.bits[i];
          state.bits[i] = prev === 0 ? 1 : 0;
          if (prev !== 1) { break; }
        }
      }

      state.last_clk = inp.clk;
      out.q = state.bits;
    },
  }, circ);

  const regN = <N extends Multi>(N: N) => createPrimitiveModule({
    name: `reg${N}`,
    inputs: { d: N, load: 1, clk: 1 },
    outputs: { q: N },
    state: { data: Connection.gen<State, N>(N, () => 0), last_clk: 0 },
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
    jkCounterN: <N extends Multi>(N: N) => jkCounterN(N)(),
    counterSimN: <N extends Multi>(N: N) => counterSimN(N)(),
    reg2: regN(2),
    reg4: regN(4),
    reg8: regN(8),
    reg16: regN(16),
    regN: <N extends Multi>(N: N) => regN(N)(),
  };
};