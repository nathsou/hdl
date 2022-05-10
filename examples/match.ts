import { createModule } from "../src/core";
import { createSimulator } from '../src/sim/sim';
import { match3 } from '../src/modules/mux';
import { Tuple } from "../src/utils";

const { bin } = Tuple;

const top = createModule({
  name: 'top',
  inputs: {},
  outputs: { leds: 3 },
  connect(_, out) {
    out.leds = match3(bin(4, 3), {
      0: bin(0, 3),
      1: bin(1, 3),
      2: bin(2, 3),
      3: bin(3, 3),
      _: bin(7, 3),
    });
  },
});

const main = () => {
  const mod = top();
  const sim = createSimulator(mod);

  sim.input({});
  console.log(sim.state.read(mod.out.leds).join(''));
};

main();