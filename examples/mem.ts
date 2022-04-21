import { createCircuit, width } from "../src/core";
import { createSimulator } from '../src/sim/sim';

const { createModule, primitives: { regs } } = createCircuit();

const N = 16;

const counterN = regs.counterN(N);

const top = createModule({
  name: 'top',
  inputs: { clk: width[1] },
  outputs: { leds: width[N] },
  connect(inp, out) {
    const counter = counterN();

    counter.in.clk = inp.clk;
    counter.in.count_enable = 1;

    out.leds = counter.out.q;
  },
});


const main = () => {
  const mod = top();
  const sim = createSimulator(mod, 'event-driven');

  for (let i = 0; i < 2 ** N; i++) {
    sim.input({ clk: 0 });
    sim.input({ clk: 1 });
    console.log(sim.state.read(mod.out.leds).join(''));
  }
};

main();