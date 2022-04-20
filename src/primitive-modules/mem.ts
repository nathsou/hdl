import { Circuit, createModule, width } from "../core";
import { Gates } from "./gates";

export const createMemoryModules = (circ: Circuit, gates: Gates) => {
  const srLatch = createModule({
    name: 'sr_latch',
    inputs: { s: width[1], r: width[1] },
    outputs: { q: width[1], qbar: width[1] },
    connect(inp, out) {
      const top = gates.nor_();
      const bot = gates.nor_();

      top.in.a = inp.s;
      top.in.b = bot.out.q;

      bot.in.a = top.out.q;
      bot.in.b = inp.r;

      out.q = bot.out.q;
      out.qbar = top.out.q;
    },
  }, circ);

  const dLatch = createModule({
    name: 'd_latch',
    inputs: { d: width[1], enable: width[1] },
    outputs: { q: width[1], qbar: width[1] },
    connect(inp, out) {
      const sr = srLatch();

      sr.in.s = gates.and(inp.d, inp.enable);
      sr.in.r = gates.and(gates.not(inp.d), inp.enable);

      out.q = sr.out.q;
      out.qbar = sr.out.qbar;
    },
  }, circ);

  const dFlipFlop = createModule({
    name: 'd_flip_flop',
    inputs: { d: width[1], clk: width[1] },
    outputs: { q: width[1], qbar: width[1] },
    connect(inp, out) {
      const latch = dLatch();
      latch.in.d = inp.d;
      latch.in.enable = inp.clk;
      out.q = latch.out.q;
      out.qbar = latch.out.qbar;
    },
  }, circ);

  const jkFlipFlop = createModule({
    name: 'jk_flip_flop',
    inputs: { j: width[1], k: width[1], clk: width[1] },
    outputs: { q: width[1], qbar: width[1] },
    connect(inp, out) {
      const sr = srLatch();
      sr.in.s = gates.and(sr.out.qbar, gates.and(inp.j, inp.clk));
      sr.in.r = gates.and(sr.out.q, gates.and(inp.k, inp.clk));

      out.q = sr.out.q;
      out.qbar = sr.out.qbar;
    },
  }, circ);

  return {
    srLatch,
    dLatch,
    dFlipFlop,
    jkFlipFlop,
  };
};