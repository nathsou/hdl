import { Circuit, Connection, createModule, createPrimitiveModule, Multi, MultiIO, State } from "../core";
import { Tuple } from "../utils";
import { ArithmeticModules } from "./arith";
import { GateModules } from "./gates";
import { MemoryModules } from "./mem";

export const createRegisters = (
  circ: Circuit, { and }: GateModules,
  { leaderFollowerJKFlipFlop: jkFF }: MemoryModules,
  arith: ArithmeticModules
) => {
  const jkCounter = <N extends Multi>(N: N) => createModule({
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

  const counter = <N extends Multi>(N: N) => createModule({
    name: `counter${N}`,
    inputs: { count_enable: 1, clk: 1 },
    outputs: { q: N },
    connect(inp, out) {
      const adder = arith.adder(N);
      const count = reg(N)();

      count.in.clk = inp.clk;
      count.in.load = inp.count_enable;
      adder.in.carry_in = inp.count_enable;
      adder.in.a = count.out.q;
      adder.in.b = Connection.gen(N, () => State.zero);
      count.in.d = adder.out.sum;

      out.q = count.out.q;
    },
  }, circ);

  const counterSim = <N extends Multi>(N: N) => createPrimitiveModule({
    name: `counter_sim${N}`,
    inputs: { count_enable: 1, clk: 1 },
    outputs: { q: N },
    state: { bits: Connection.gen(N, () => State.zero), last_clk: 0 },
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

  const reg = <N extends Multi>(
    N: N
  ) => (initialData = Connection.gen(N, () => State.zero)) => createPrimitiveModule({
    name: `reg${N}`,
    inputs: { d: N, load: 1, clk: 1 },
    outputs: { q: N },
    state: { data: initialData, last_clk: 0 },
    simulate(inp, out, state) {
      const rising = inp.clk && !state.last_clk;

      if (rising && inp.load) {
        state.data = inp.d;
      }

      state.last_clk = inp.clk;
      out.q = state.data;
    },
  }, circ)();

  return {
    counter: <N extends Multi>(N: N) => counter(N)(),
    jkCounter: <N extends Multi>(N: N) => jkCounter(N)(),
    counterSim: <N extends Multi>(N: N) => counterSim(N)(),
    reg2: reg(2),
    reg4: reg(4),
    reg8: reg(8),
    reg16: reg(16),
    reg: <N extends Multi>(N: N, initialData?: MultiIO<N, State>) => reg(N)(initialData),
  };
};