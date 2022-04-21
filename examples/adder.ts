import { createCircuit, width } from "../src/core";
import { createSimulator } from '../src/sim/sim';
import { bin } from "../src/utils";

const { createModule, primitives: { arith } } = createCircuit();

const N = 32;

const top = createModule({
  name: 'top',
  inputs: { a: width[N], b: width[N], subtract: width[1] },
  outputs: { leds: width[N], overflow: width[1] },
  connect(inp, out) {
    const adder = arith.adderSubtractorN(N);

    adder.in.a = inp.a;
    adder.in.b = inp.b;
    adder.in.subtract = inp.subtract;

    out.leds = adder.out.sum;
    out.overflow = adder.out.carry_out;
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

  sim.input({ a: bin(2 ** (N - 1) - 1, N), b: bin(2 ** (N - 1), N), subtract: 0 });
  logOutput();

  sim.input({ a: bin(2 ** (N - 1), N), b: bin(2 ** (N - 1), N), subtract: 0 });
  logOutput();

  sim.input({ a: bin(202, N), b: bin(31, N), subtract: 1 });
  logOutput();

  sim.input({ a: bin(42, N), b: bin(23, N), subtract: 0 });
  logOutput();

  sim.input({ a: bin(127, N), b: bin(128, N), subtract: 0 });
  logOutput();

  sim.input({ a: bin(129, N), b: bin(127, N), subtract: 1 });
  logOutput();
};

main();