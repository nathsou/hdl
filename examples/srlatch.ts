import { createBasicModules } from '../src/basic';
import { createCircuit, width } from "../src/core";
import { createSim, deref } from '../src/sim';

const { circuit, createModule } = createCircuit();
const { mem } = createBasicModules(circuit);

const top = createModule({
  name: 'top',
  inputs: {},
  outputs: { leds: width[1] },
  connect(_, out) {
    const latch = mem.srLatch();

    latch.in.s = 1;
    latch.in.r = 0;

    out.leds = latch.out.q;
  },
});


const main = () => {
  top();

  const { state, step } = createSim(circuit);

  step();

  const res = [
    deref(state, 'leds:0'),
  ];

  console.log(res);
};

main();