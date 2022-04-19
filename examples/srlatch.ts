import { createCircuit, width } from "../src/core";
import { createSimulator } from '../src/sim/sim';

const { createModule, primitives: { mem } } = createCircuit();

const top = createModule({
  name: 'top',
  inputs: { s: width[1], r: width[1] },
  outputs: { leds: width[2] },
  connect(inp, out) {
    const latch = mem.srLatch();

    latch.in.s = inp.s;
    latch.in.r = inp.r;

    out.leds = [latch.out.q, latch.out.qbar];
  },
});


const main = () => {
  const mod = top();
  const sim = createSimulator(mod, 'event-driven');

  sim.input({ s: 1, r: 0 });
  console.log(sim.state.read(mod.out.leds));

  sim.input({ s: 0, r: 1 });
  console.log(sim.state.read(mod.out.leds));
};

main();