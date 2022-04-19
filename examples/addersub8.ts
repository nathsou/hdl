import { bin, createCircuit, width } from "../src/core";
import { createSimulator } from '../src/sim/sim';

const { createModule, primitives: { arith } } = createCircuit();

const top = createModule({
  name: 'top',
  inputs: { a: width[8], b: width[8], subtract: width[1] },
  outputs: { leds: width[8], overflow: width[1] },
  connect(inp, out) {
    const fa = arith.adderSubtractor8();

    fa.in.a = inp.a;
    fa.in.b = inp.b;
    fa.in.subtract = inp.subtract;

    out.leds = fa.out.sum;
    out.overflow = fa.out.carry_out;
  },
});


const main = () => {
  const mod = top();
  const sim = createSimulator(mod, 'levelization');

  sim.input({ a: bin(17, 8), b: bin(7, 8), subtract: 0 });
  const res1 = sim.state.read(mod.out.leds);

  sim.input({ a: bin(202, 8), b: bin(31, 8), subtract: 1 });
  const res2 = sim.state.read(mod.out.leds);

  console.log(res1.join(''), parseInt(res1.join(''), 2));
  console.log(res2.join(''), parseInt(res2.join(''), 2));
};

main();