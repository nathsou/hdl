import { AdderSubtractor } from "../src/modules/arith";
import { defineModule } from "../src/core";
import { createSimulator } from '../src/sim/sim';
import { Tuple } from "../src/utils";

const { bin } = Tuple;

const N = 32;

const Top = defineModule({
  name: 'top',
  inputs: { a: N, b: N, subtract: 1 },
  outputs: { leds: N, overflow: 1 },
  connect(inp, out) {
    const adder = AdderSubtractor(N);

    adder.in.a = inp.a;
    adder.in.b = inp.b;
    adder.in.subtract = inp.subtract;

    out.leds = adder.out.sum;
    out.overflow = adder.out.carryOut;
  },
});


const main = () => {
  const mod = Top();
  const sim = createSimulator(mod, {
    approach: 'levelization',
    checkConnections: true,
  });

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