import { IO, createCircuit } from "../src/core";
import { createSimulator } from '../src/sim/sim';
import { Tuple, Range } from "../src/utils";

const { createModule, primitives: { mux, regs } } = createCircuit();

const pow2 = {
  1: 2,
  2: 4,
  3: 8,
  4: 16,
  5: 32,
} as const;

const multiplexers = {
  1: mux.mux1,
  2: mux.mux2,
  3: mux.mux3,
  4: mux.mux4,
  5: mux.mux5,
};

const muxSize = 5;

const top = createModule({
  name: 'top',
  inputs: { clk: 1, sel: muxSize },
  outputs: { leds: 8 },
  connect({ clk, sel }, out) {
    const rs = Tuple.gen(pow2[muxSize], i => regs.reg8(Tuple.bin(i, 8)));
    const mux = multiplexers[muxSize](8);

    IO.forward({ clk }, rs);

    Range.iter(0, pow2[muxSize], i => {
      mux.in[`d${i}`] = rs[i].out.q;
    });

    mux.in.sel = sel;

    out.leds = mux.out.q;
  },
});


const main = () => {
  const mod = top();
  const sim = createSimulator(mod);

  const logState = () => {
    const state = sim.state.read(mod.out.leds).join('');
    console.log(state, parseInt(state, 2));
  };

  for (let i = 0; i < pow2[muxSize]; i++) {
    const sel = Tuple.bin(i, muxSize);
    sim.input({ clk: 0, sel });
    sim.input({ clk: 1, sel });
    logState();
  }
};

main();