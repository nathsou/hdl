import { GlobalState } from '../../core';
import { mux2, mux4, mux8, mux16, mux32 } from '../../modules/mux';
import { createSimulator } from '../../sim/sim';
import { Range, Tuple } from '../../utils';

describe('mux', () => {
  afterEach(() => {
    GlobalState.reset();
  });

  test('mux2', () => {
    const m = createSimulator(mux2(1));

    m.expect({ d0: 0, d1: 1, sel: 0 }, { q: 0 });
    m.expect({ d0: 0, d1: 1, sel: 1 }, { q: 1 });
  });

  test('mux4', () => {
    const m = createSimulator(mux4(2));

    for (let i = 0; i < 4; i++) {
      m.expect({
        d0: [0, 0],
        d1: [0, 1],
        d2: [1, 0],
        d3: [1, 1],
        sel: Tuple.bin(i, 2)
      },
        { q: Tuple.bin(i, 2) }
      );
    }
  });

  test('mux8', () => {
    const m = createSimulator(mux8(3));
    const cases = Tuple.mapObject(Range.map(0, 8, n => [`d${n}`, Tuple.bin(n, 3)]));

    for (let i = 0; i < 8; i++) {
      m.expect({ ...cases, sel: Tuple.bin(i, 3) },
        { q: Tuple.bin(i, 3) }
      );
    }
  });

  test('mux16', () => {
    const m = createSimulator(mux16(4));
    const cases = Tuple.mapObject(Range.map(0, 16, n => [`d${n}`, Tuple.bin(n, 4)]));

    for (let i = 0; i < 16; i++) {
      m.expect({ ...cases, sel: Tuple.bin(i, 4) },
        { q: Tuple.bin(i, 4) }
      );
    }
  });

  test('mux32', () => {
    const m = createSimulator(mux32(5));
    const cases = Tuple.mapObject(Range.map(0, 32, n => [`d${n}`, Tuple.bin(n, 5)]));

    for (let i = 0; i < 32; i++) {
      m.expect({ ...cases, sel: Tuple.bin(i, 5) },
        { q: Tuple.bin(i, 5) }
      );
    }
  });
});