import { defineModule, IO, Multi, State } from "../core";
import { Tuple } from "../utils";
import { Adder } from "./arith";
import { and } from "./gates";
import { LeaderFollowerJKFlipFlop } from "./mem";

export const JKCounter = <N extends Multi>(N: N) => defineModule({
  name: `jk_counter${N}`,
  inputs: { count_enable: 1, clk: 1 },
  outputs: { q: N },
  connect(inp, out) {
    const jks = Tuple.gen(N, LeaderFollowerJKFlipFlop);

    IO.forward({ clk: inp.clk }, jks);

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

    out.q = IO.gen(N, i => jks[N - 1 - i].out.q);
  },
})();

export const Counter = <N extends Multi>(N: N) => defineModule({
  name: `counter${N}`,
  inputs: { count_enable: 1, clk: 1 },
  outputs: { q: N },
  connect(inp) {
    const adder = Adder(N);
    const count = Reg(N);

    count.in.clk = inp.clk;
    count.in.load = inp.count_enable;
    adder.in.carryIn = inp.count_enable;
    adder.in.a = count.out.q;
    adder.in.b = IO.gen(N, () => State.zero);
    count.in.d = adder.out.sum;

    return { q: count.out.q };
  },
})();

export const CounterSim = <N extends Multi>(N: N) => defineModule({
  name: `counter_sim${N}`,
  inputs: { count_enable: 1, clk: 1 },
  outputs: { q: N },
  state: { bits: State.gen(N, () => State.zero), last_clk: State.zero },
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
});

export const Reg = <N extends Multi>(N: N) => {
  const zero = State.gen(N, () => State.zero);

  return defineModule({
    name: `reg${N}`,
    inputs: { d: N, load: 1, clk: 1, rst: 1 },
    outputs: { q: N },
    state: { data: zero, last_clk: State.zero },
    simulate(inp, out, state) {
      const rising = inp.clk && !state.last_clk;

      if (inp.rst === 1) {
        state.data = zero;
      } else if (rising && inp.load) {
        state.data = inp.d;
      }

      state.last_clk = inp.clk;
      out.q = state.data;
    },
  })();
};

export const CounterReg = <N extends Multi>(N: N) => {
  const zero = State.gen(N, () => State.zero);

  return defineModule({
    name: `counter_reg${N}`,
    inputs: { d: N, load: 1, countEnable: 1, clk: 1, rst: 1 },
    outputs: { q: N, carryOut: 1 },
    state: {
      bits: State.gen(N, () => State.zero),
      lastClk: State.zero,
      carryOut: State.zero,
    },
    simulate(inp, out, state) {
      const rising = state.lastClk === 0 && inp.clk;

      if (inp.rst === 1) {
        state.bits = zero;
      } else if (rising) {
        if (inp.load) {
          state.bits = inp.d;
        }

        if (inp.countEnable) {
          state.carryOut = 1;
          for (let i = N - 1; i >= 0; i--) {
            const prev = state.bits[i];
            state.bits[i] = prev === 0 ? 1 : 0;
            if (prev !== 1) {
              state.carryOut = 0;
              break;
            }
          }
        }
      }

      state.lastClk = inp.clk;
      out.q = state.bits;
      out.carryOut = state.carryOut;
    },
  })();
};

export const Reg2 = () => Reg(2);
export const Reg4 = () => Reg(4);
export const Reg8 = () => Reg(8);
export const Reg16 = () => Reg(16);