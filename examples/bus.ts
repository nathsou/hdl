import { createBus, createSimulator, defineModule, IO, Tuple } from "../src";
import { reg8 } from "../src/modules/regs";
import { withTriStateOutput } from "../src/modules/tristate";

const top = defineModule({
  name: 'top',
  inputs: { clk: 1 },
  outputs: { leds: 8 },
  connect({ clk }, out) {
    const bus = createBus('data_bus', 8);
    const reg1 = withTriStateOutput(reg8(), ['q']);
    const reg2 = withTriStateOutput(reg8(), ['q']);
    reg1.in.d = Tuple.bin(17, 8);
    reg2.in.d = Tuple.bin(23, 8);

    IO.forward({ clk, load: 1 }, [reg1, reg2]);

    reg1.in.outputEnable = 1;
    reg2.in.outputEnable = 0;

    reg1.in.d = bus.read();

    bus.connect(reg1.out.q, reg2.out.q);

    out.leds = bus.read();
  }
})();

const main = () => {
  const sim = createSimulator(top, {
    approach: 'event-driven',
    checkConnections: true,
  });

  sim.input({ clk: 0 });
  sim.input({ clk: 1 });

  const out = sim.state.read(top.out.leds).join('');
  console.log(parseInt(out, 2), out);
};

main();