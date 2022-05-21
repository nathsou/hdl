import { defineSimulatedModule } from "../core";

export const npn = defineSimulatedModule({
  name: 'npn',
  inputs: { base: 1, collector: 1 },
  outputs: { emitter: 1 },
  simulate(inp, out) {
    out.emitter = inp.base === 1 ? inp.collector : 0;
  },
});