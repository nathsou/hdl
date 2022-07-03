import { GlobalState } from '../../core';
import { dLatch, leaderFollowerJKFlipFlop, srLatch, srLatchWithEnable } from '../../modules/mem';
import { createSimulator } from '../../sim/sim';

describe('mem', () => {
  afterEach(() => {
    GlobalState.reset();
  });

  test('srLatch', () => {
    const sr = createSimulator(srLatch());

    sr.expect({ s: 0, r: 0 }, { q: 0, qbar: 1 });
    sr.expect({ s: 1, r: 0 }, { q: 1, qbar: 0 });
    sr.expect({ s: 0, r: 0 }, { q: 1, qbar: 0 });
    sr.expect({ s: 0, r: 1 }, { q: 0, qbar: 1 });
    sr.expect({ s: 1, r: 1 }, { q: 'x', qbar: 'x' });
  });

  test('srLatchWithEnable', () => {
    const sr = createSimulator(srLatchWithEnable());

    sr.expect({ s: 0, r: 0, enable: 1 }, { q: 'x', qbar: 'x' });
    sr.expect({ s: 1, r: 0, enable: 1 }, { q: 1, qbar: 0 });
    sr.expect({ s: 0, r: 1, enable: 0 }, { q: 1, qbar: 0 });
    sr.expect({ s: 0, r: 1, enable: 1 }, { q: 0, qbar: 1 });
    sr.expect({ s: 1, r: 0, enable: 0 }, { q: 0, qbar: 1 });
    sr.expect({ s: 1, r: 0, enable: 1 }, { q: 1, qbar: 0 });
  });

  test('dLatch', () => {
    const latch = createSimulator(dLatch());

    latch.expect({ d: 0, enable: 0 }, { q: 1, qbar: 0 });
    latch.expect({ d: 1, enable: 1 }, { q: 1, qbar: 0 });
    latch.expect({ d: 0, enable: 1 }, { q: 0, qbar: 1 });
    latch.expect({ d: 1, enable: 0 }, { q: 0, qbar: 1 });
  });

  test('leaderFollowerJKFlipFlop', () => {
    const jk = createSimulator(leaderFollowerJKFlipFlop());

    jk.expect({ j: 1, k: 0, clk: 0 }, { q: 0, qbar: 1 });
    jk.expect({ j: 1, k: 0, clk: 1 }, { q: 1, qbar: 0 });
    jk.expect({ j: 0, k: 1, clk: 0 }, { q: 1, qbar: 0 });
    jk.expect({ j: 0, k: 1, clk: 1 }, { q: 0, qbar: 1 });
    jk.expect({ j: 1, k: 1, clk: 0 }, { q: 0, qbar: 1 });
    jk.expect({ j: 1, k: 1, clk: 1 }, { q: 1, qbar: 0 });
    jk.expect({ j: 1, k: 1, clk: 0 }, { q: 0, qbar: 1 });
    jk.expect({ j: 1, k: 1, clk: 1 }, { q: 1, qbar: 0 });
    jk.expect({ j: 0, k: 0, clk: 0 }, { q: 0, qbar: 1 });
  });
});