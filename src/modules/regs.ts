import { createModule, createSimulatedModule, IO, Multi, State } from "../core";
import { Tuple } from "../utils";
import { and } from "./gates";
import * as arith from "./arith";
import { leaderFollowerJKFlipFlop } from "./mem";

export const raw = {
  jkCounter: <N extends Multi>(N: N) => createModule({
    name: `jk_counter${N}`,
    inputs: { count_enable: 1, clk: 1 },
    outputs: { q: N },
    connect(inp, out) {
      const jks = Tuple.gen(N, leaderFollowerJKFlipFlop);

      IO.forward({ clk: inp.clk }, jks);

      jks[0].in.j = inp.count_enable;
      jks[0].in.k = inp.count_enable;

      let andChain = jks[0].out.q;

      for (let i = 1; i < N; i++) {
        jks[i].in.j = andChain;
        jks[i].in.k = andChain;

        if (i !== N - 1) {
          andChain = and<1>(andChain, jks[i].out.q);
        }
      }

      out.q = IO.gen(N, i => jks[N - 1 - i].out.q);
    },
  }),
  counter: <N extends Multi>(N: N) => createModule({
    name: `counter${N}`,
    inputs: { count_enable: 1, clk: 1 },
    outputs: { q: N },
    connect(inp, out) {
      const adder = arith.adder(N);
      const count = raw.reg(N)();

      count.in.clk = inp.clk;
      count.in.load = inp.count_enable;
      adder.in.carry_in = inp.count_enable;
      adder.in.a = count.out.q;
      adder.in.b = IO.gen(N, () => State.zero);
      count.in.d = adder.out.sum;

      out.q = count.out.q;
    },
  }),
  counterSim: <N extends Multi>(N: N) => createSimulatedModule({
    name: `counter_sim${N}`,
    inputs: { count_enable: 1, clk: 1 },
    outputs: { q: N },
    state: { bits: State.gen(N, () => State.zero), last_clk: 0 },
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
  }),
  reg: <N extends Multi>(
    N: N
  ) => (initialData = State.gen(N, () => State.zero)) => createSimulatedModule({
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
  })(),
};


export const counter = <N extends Multi>(N: N) => raw.counter(N)();
export const jkCounter = <N extends Multi>(N: N) => raw.jkCounter(N)();
export const counterSim = <N extends Multi>(N: N) => raw.counterSim(N)();
export const reg2 = raw.reg(2);
export const reg4 = raw.reg(4);
export const reg8 = raw.reg(8);
export const reg16 = raw.reg(16);
export const reg = <N extends Multi>(N: N, initialData?: N extends 1 ? State : Tuple<State, N>) => raw.reg(N)(initialData);