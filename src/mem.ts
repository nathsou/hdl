import { Circuit, createModule, width } from "./core";
import { Gates } from "./gates";

export const createMemoryModules = (circ: Circuit, gates: Gates) => {
  const srLatch = createModule({
    name: 'sr_latch',
    inputs: { s: width[1], r: width[1] },
    outputs: { q: width[1], qbar: width[1] },
    connect(inp, out) {
      const topNand = gates.nand();
      const botNand = gates.nand();

      topNand.in.a = inp.s;
      topNand.in.b = botNand.out.q;

      botNand.in.a = topNand.out.q;
      botNand.in.b = inp.r;

      out.q = botNand.out.q;
      out.qbar = topNand.out.q;
    },
  }, circ);

  return {
    srLatch,
  };
};