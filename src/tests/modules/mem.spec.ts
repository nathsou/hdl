import { GlobalState } from '../../core';
import { dLatch, srLatch, srLatchWithEnable } from '../../modules/mem';
import { createSimulator } from '../../sim/sim';

describe('mem', () => {
  afterEach(() => {
    GlobalState.reset();
  });

  test('srLatch', () => {
    const sr = createSimulator(srLatch());

    // undefined behavior
    sr.expect({ s: 0, r: 0 }, { q: 0, qbar: 1 });
    sr.expect({ s: 1, r: 0 }, { q: 1, qbar: 0 });
    sr.expect({ s: 0, r: 0 }, { q: 1, qbar: 0 });
    sr.expect({ s: 0, r: 1 }, { q: 0, qbar: 1 });
    // undefined behavior
    sr.expect({ s: 1, r: 1 }, { q: 0, qbar: 0 });
  });

  test('srLatchWithEnable', () => {
    const sr = createSimulator(srLatchWithEnable());

    sr.expect({ s: 1, r: 0, enable: 1 }, { q: 1, qbar: 0 });
    sr.expect({ s: 0, r: 1, enable: 0 }, { q: 1, qbar: 0 });
    sr.expect({ s: 0, r: 1, enable: 1 }, { q: 0, qbar: 1 });
    sr.expect({ s: 1, r: 0, enable: 0 }, { q: 0, qbar: 1 });
    sr.expect({ s: 1, r: 0, enable: 1 }, { q: 1, qbar: 0 });
  });
});