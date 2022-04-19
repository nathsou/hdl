import { Circuit, createPrimitiveModule, width } from "../core";

export const createTransitors = (circ: Circuit) => {
  const npn = createPrimitiveModule({
    name: 'npn',
    inputs: { base: width[1], collector: width[1] },
    outputs: { emitter: width[1] },
    simulate(inp, out) {
      out.emitter = inp.base === 1 ? inp.collector : 0;
    },
  }, circ);

  return { npn };
};