import { writeFileSync } from 'fs';
import { createBasicModules } from '../src/basic';
import { bin, createCircuit, width } from "../src/core";
import { createGraphDotFile } from '../src/graph';
import { createSim, deref } from '../src/sim';

const { circuit, createModule } = createCircuit();
const { arith } = createBasicModules(circuit);

const top = createModule({
  name: 'top',
  inputs: {},
  outputs: { leds: width[8], overflow: width[1] },
  connect(_, out) {
    const fa = arith.adderSubtractor8();

    fa.in.a = bin(16, 8);
    fa.in.b = bin(7, 8);
    fa.in.subtract = 0;

    out.leds = fa.out.sum;
    out.overflow = fa.out.carry_out;
  },
});


const main = () => {
  top();

  const { state, step } = createSim(circuit);

  writeFileSync('circuit.gv', createGraphDotFile(circuit));

  step();

  const res = [
    deref(state, 'leds7:0'),
    deref(state, 'leds6:0'),
    deref(state, 'leds5:0'),
    deref(state, 'leds4:0'),
    deref(state, 'leds3:0'),
    deref(state, 'leds2:0'),
    deref(state, 'leds1:0'),
    deref(state, 'leds0:0'),
  ];

  console.log({ overflow: deref(state, 'overflow:0') }, res.join(''), parseInt(res.join(''), 2));
};

main();