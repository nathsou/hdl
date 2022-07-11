import { defineModule } from "../src/core";
import { matchWithDefault } from '../src/modules/mux';
import { createSimulator } from '../src/sim/sim';
import { Tuple } from "../src/utils";

const { bin } = Tuple;

const Top = defineModule({
  name: 'top',
  inputs: {},
  outputs: { leds: 3 },
  connect(_, out) {
    out.leds = matchWithDefault(bin(4, 3), {
      0: bin(0, 3),
      1: bin(1, 3),
      2: bin(2, 3),
      3: bin(3, 3),
      _: bin(7, 3),
    });
  },
});

const main = () => {
  const mod = Top();
  const sim = createSimulator(mod);

  sim.input({});
  console.log(sim.state.read(mod.out.leds).join(''));
};

main();