import { createCircuit, width } from "../src/core";
import { createSimulator } from '../src/sim/sim';
import { bin } from "../src/utils";

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

  const logOutput = () => {
    const res = sim.state.read(mod.out.leds);
    const overflow = sim.state.read(mod.out.overflow);
    console.log({ overflow }, res.join(''), parseInt(res.join(''), 2));
  };

  sim.input({ a: bin(17, 8), b: bin(7, 8), subtract: 0 });
  logOutput();

  sim.input({ a: bin(202, 8), b: bin(31, 8), subtract: 1 });
  logOutput();

  sim.input({ a: bin(42, 8), b: bin(23, 8), subtract: 0 });
  logOutput();

  sim.input({ a: bin(127, 8), b: bin(128, 8), subtract: 0 });
  logOutput();

  sim.input({ a: bin(129, 8), b: bin(127, 8), subtract: 0 });
  logOutput();
};

main();