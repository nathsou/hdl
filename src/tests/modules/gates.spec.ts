import { Not, And, Nand, Or, Nor, Xor, Xnor } from '../../modules/gates';
import { createSimulator } from '../../sim/sim';

describe('gates', () => {
  test('not', () => {
    const not = createSimulator(Not());
    not.expect({ d: 'x' }, { q: 'x' });
    not.expect({ d: 0 }, { q: 1 });
    not.expect({ d: 1 }, { q: 0 });
  });

  test('and', () => {
    const and = createSimulator(And());
    and.expect({ a: 0, b: 0 }, { q: 0 });
    and.expect({ a: 0, b: 0 }, { q: 0 });
    and.expect({ a: 0, b: 1 }, { q: 0 });
    and.expect({ a: 1, b: 0 }, { q: 0 });
    and.expect({ a: 1, b: 1 }, { q: 1 });
    and.expect({ a: 0, b: 'x' }, { q: 'x' });
    and.expect({ a: 1, b: 'x' }, { q: 'x' });
    and.expect({ a: 'x', b: 1 }, { q: 'x' });
    and.expect({ a: 'x', b: 0 }, { q: 'x' });
    and.expect({ a: 'x', b: 'x' }, { q: 'x' });
  });

  test('or', () => {
    const or = createSimulator(Or());
    or.expect({ a: 0, b: 0 }, { q: 0 });
    or.expect({ a: 0, b: 1 }, { q: 1 });
    or.expect({ a: 1, b: 0 }, { q: 1 });
    or.expect({ a: 1, b: 1 }, { q: 1 });
  });

  test('xor', () => {
    const xor = createSimulator(Xor());
    xor.expect({ a: 0, b: 0 }, { q: 0 });
    xor.expect({ a: 0, b: 1 }, { q: 1 });
    xor.expect({ a: 1, b: 0 }, { q: 1 });
    xor.expect({ a: 1, b: 1 }, { q: 0 });
  });

  test('nand', () => {
    const nand = createSimulator(Nand());
    nand.expect({ a: 0, b: 0 }, { q: 1 });
    nand.expect({ a: 0, b: 1 }, { q: 1 });
    nand.expect({ a: 1, b: 0 }, { q: 1 });
    nand.expect({ a: 1, b: 1 }, { q: 0 });
  });

  test('nor', () => {
    const nor = createSimulator(Nor());
    nor.expect({ a: 0, b: 0 }, { q: 1 });
    nor.expect({ a: 0, b: 1 }, { q: 0 });
    nor.expect({ a: 1, b: 0 }, { q: 0 });
    nor.expect({ a: 1, b: 1 }, { q: 0 });
  });

  test('xnor', () => {
    const xnor = createSimulator(Xnor());
    xnor.expect({ a: 0, b: 0 }, { q: 1 });
    xnor.expect({ a: 0, b: 1 }, { q: 0 });
    xnor.expect({ a: 1, b: 0 }, { q: 0 });
    xnor.expect({ a: 1, b: 1 }, { q: 1 });
  });
});