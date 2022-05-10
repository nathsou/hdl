import { createModule } from "../core";
import { and, not, gates } from "./gates";

export const srLatch = createModule({
  name: 'sr_latch',
  inputs: { s: 1, r: 1 },
  outputs: { q: 1, qbar: 1 },
  connect(inp, out) {
    const top = gates.nor();
    const bot = gates.nor();

    top.in.a = inp.s;
    top.in.b = bot.out.q;

    bot.in.a = top.out.q;
    bot.in.b = inp.r;

    out.q = bot.out.q;
    out.qbar = top.out.q;
  },
});

export const srLatchWithEnable = createModule({
  name: 'sr_latch_with_enable',
  inputs: { s: 1, r: 1, enable: 1 },
  outputs: { q: 1, qbar: 1 },
  connect(inp, out) {
    const sr = srLatch();

    sr.in.s = and<1>(inp.s, inp.enable);
    sr.in.r = and<1>(inp.r, inp.enable);

    out.q = sr.out.q;
    out.qbar = sr.out.qbar;
  },
});

export const dLatch = createModule({
  name: 'd_latch',
  inputs: { d: 1, enable: 1 },
  outputs: { q: 1, qbar: 1 },
  connect(inp, out) {
    const sr = srLatchWithEnable();

    sr.in.s = inp.d;
    sr.in.r = not<1>(inp.d);
    sr.in.enable = inp.enable;

    out.q = sr.out.q;
    out.qbar = sr.out.qbar;
  },
});

export const dFlipFlop = createModule({
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
});

// also known as master-slave JK flip-flop
export const leaderFollowerJKFlipFlop = createModule({
  name: 'leader_follower_jk_flip_flop',
  inputs: { j: 1, k: 1, clk: 1 },
  outputs: { q: 1, qbar: 1 },
  connect(inp, out) {
    const leader = srLatchWithEnable();
    const follower = srLatchWithEnable();

    leader.in.enable = inp.clk;
    leader.in.s = and<1>(inp.j, follower.out.qbar);
    leader.in.r = and<1>(inp.k, follower.out.q);

    follower.in.enable = not<1>(inp.clk);
    follower.in.s = leader.out.q;
    follower.in.r = leader.out.qbar;

    out.q = follower.out.q;
    out.qbar = follower.out.qbar;
  },
});