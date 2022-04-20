import { createCircuit, width } from "../src/core";
import { createSimulator } from '../src/sim/sim';

const { createModule, primitives: { mem } } = createCircuit();

const top = createModule({
  name: 'top',
  inputs: { j: width[1], k: width[1], clk: width[1] },
  outputs: { leds: width[2] },
  connect(inp, out) {
    const ff = mem.jkFlipFlop();

    ff.in.j = inp.j;
    ff.in.k = inp.k;
    ff.in.clk = inp.clk;

    out.leds = [ff.out.q, ff.out.qbar];
  },
});


const main = () => {
  const mod = top();
  const sim = createSimulator(mod, 'event-driven');

  sim.input({ j: 0, k: 0, clk: 0 });
  console.log(sim.state.read(mod.out.leds));

  sim.input({ j: 1, k: 0, clk: 1 });
  console.log(sim.state.read(mod.out.leds));

  sim.input({ j: 0, k: 1, clk: 0 });
  console.log(sim.state.read(mod.out.leds));
};

main();