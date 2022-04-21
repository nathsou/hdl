import { Circuit, createModule, width } from "../core";
import { Gates } from "./gates";

export type LatchesAndFlipFlops = ReturnType<typeof createMemoryModules>;

export const createMemoryModules = (circ: Circuit, { and, nor_, not }: Gates) => {
  const srLatch = createModule({
    name: 'sr_latch',
    inputs: { s: width[1], r: width[1] },
    outputs: { q: width[1], qbar: width[1] },
    connect(inp, out) {
      const top = nor_();
      const bot = nor_();

      top.in.a = inp.s;
      top.in.b = bot.out.q;

      bot.in.a = top.out.q;
      bot.in.b = inp.r;

      out.q = bot.out.q;
      out.qbar = top.out.q;
    },
  }, circ);

  const srLatchWithEnable = createModule({
    name: 'sr_latch_with_enable',
    inputs: { s: width[1], r: width[1], enable: width[1] },
    outputs: { q: width[1], qbar: width[1] },
    connect(inp, out) {
      const sr = srLatch();

      sr.in.s = and(inp.s, inp.enable);
      sr.in.r = and(inp.r, inp.enable);

      out.q = sr.out.q;
      out.qbar = sr.out.qbar;
    },
  }, circ);

  const dLatch = createModule({
    name: 'd_latch',
    inputs: { d: width[1], enable: width[1] },
    outputs: { q: width[1], qbar: width[1] },
    connect(inp, out) {
      const sr = srLatchWithEnable();

      sr.in.s = inp.d;
      sr.in.r = not(inp.d);
      sr.in.enable = inp.enable;

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

  // also known as master-slave JK flip-flop
  const leaderFollowerJKFlipFlop = createModule({
    name: 'leader_follower_jk_flip_flop',
    inputs: { j: width[1], k: width[1], clk: width[1] },
    outputs: { q: width[1], qbar: width[1] },
    connect(inp, out) {
      const leader = srLatchWithEnable();
      const follower = srLatchWithEnable();

      leader.in.enable = inp.clk;
      leader.in.s = and(inp.j, follower.out.qbar);
      leader.in.r = and(inp.k, follower.out.q);

      follower.in.enable = not(inp.clk);
      follower.in.s = leader.out.q;
      follower.in.r = leader.out.qbar;

      out.q = follower.out.q;
      out.qbar = follower.out.qbar;
    },
  }, circ);

  return {
    srLatch,
    srLatchWithEnable,
    dLatch,
    dFlipFlop,
    leaderFollowerJKFlipFlop,
  };
};