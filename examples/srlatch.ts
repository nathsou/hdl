import { createBasicModules } from '../src/basic';
import { createCircuit, width } from "../src/core";
import { createEventDrivenSim } from '../src/event-sim';

const { circuit, createModule } = createCircuit();
const { mem } = createBasicModules(circuit);

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
  const t = top();

  const sim = createEventDrivenSim(t);

  sim.input({ s: 1, r: 0 });
  console.log(sim.state.read(t.out.leds));

  sim.input({ s: 0, r: 1 });
  console.log(sim.state.read(t.out.leds));
};

main();