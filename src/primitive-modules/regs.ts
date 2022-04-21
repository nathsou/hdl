import { Circuit, createModule, createPrimitiveModule, width } from "../core";
import { bin, forwardInputs, gen, genConnections } from "../utils";
import { Gates } from "./gates";
import { LatchesAndFlipFlops } from "./mem";
import { Multi } from "./meta";

export const createRegisters = (
  circ: Circuit, { and }: Gates,
  { leaderFollowerJKFlipFlop: jkFF }: LatchesAndFlipFlops
) => {
  const counterN = <N extends Multi>(N: N) => createModule({
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

  const counterSimN = <N extends Multi>(N: N) => createPrimitiveModule({
    name: `counter${N}`,
    inputs: { count_enable: width[1], clk: width[1] },
    outputs: { q: N },
    state: { count: 0 },
    simulate(inp, out, state) {
      /// @ts-ignore
      out.q = bin(state.count, N);

      if (inp.count_enable && inp.clk) {
        state.count += 1;
      }
    },
  }, circ);

  return { counterN, counterSimN };
};