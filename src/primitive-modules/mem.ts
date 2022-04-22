import { Circuit, createModule } from "../core";
import { GateModules } from "./gates";

export type MemoryModules = ReturnType<typeof createMemoryModules>;

export const createMemoryModules = (circ: Circuit, { and, nor1, not }: GateModules) => {
  const srLatch = createModule({
    name: 'sr_latch',
    inputs: { s: 1, r: 1 },
    outputs: { q: 1, qbar: 1 },
    connect(inp, out) {
      const top = nor1();
      const bot = nor1();

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
    inputs: { s: 1, r: 1, enable: 1 },
    outputs: { q: 1, qbar: 1 },
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
    inputs: { d: 1, enable: 1 },
    outputs: { q: 1, qbar: 1 },
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
    inputs: { d: 1, clk: 1 },
    outputs: { q: 1, qbar: 1 },
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
    inputs: { j: 1, k: 1, clk: 1 },
    outputs: { q: 1, qbar: 1 },
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