import { createCircuit, width } from "../src/core";
import { createSimulator } from '../src/sim/sim';
import { forwardInputs } from "../src/utils";

const { createModule, primitives: { regs, gates } } = createCircuit();

const N = 16;

const top = createModule({
  name: 'top',
  inputs: { clk: width[1], transmit: width[1] },
  outputs: { leds: width[N] },
  connect(inp, out) {
    const reg = regs.regN(N);
    const buffer = gates.tristateN(N);
    const counter = regs.counterN(N);

    forwardInputs({ clk: inp.clk }, [reg, counter]);

    counter.in.count_enable = 1;
    buffer.in.d = counter.out.q;
    buffer.in.enable = inp.transmit;

    reg.in.clk = inp.clk;
    reg.in.load = 1;
    reg.in.d = buffer.out.q;

    out.leds = reg.out.q;
  },
});


const main = () => {
  const mod = top();
  const sim = createSimulator(mod);

  for (let i = 0; i < 2 ** N; i++) {
    sim.input({ clk: 0, transmit: 1 });
    sim.input({ clk: 1, transmit: 1 });
    console.log(sim.state.read(mod.out.leds).join(''));
  }
};

main();