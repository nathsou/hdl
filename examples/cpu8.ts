import { adderSubtractor, bidirectionalShifter, nand } from '../src';
import { Connection, defineModule, IO, Width } from '../src/core';
import { counterReg, reg8 } from '../src/modules/regs';
import { withTriStateOutput } from '../src/modules/tristate';

// op: 00 -> add, 01 -> nand, 10 -> shift
const ALU = defineModule({
  name: 'alu',
  inputs: { op: 2, a: 8, b: 8, carryIn: 1, subtract: 1, shiftDir: 1 },
  outputs: { q: 8 },
  connect({ op, a, b, carryIn, subtract }) {
    const adder = adderSubtractor(8);

    adder.in.a = a;
    adder.in.b = b;
    adder.in.carryIn = carryIn;
    adder.in.subtract = subtract;

    const shifter = bidirectionalShifter(8);

    const logic = nand(a, b);
  }
});

const CPU = defineModule({
  name: 'cpu',
  inputs: { clk: 1, rst: 1 },
  outputs: {},
  connect({ clk, rst }) {
    const r0 = withTriStateOutput(reg8(), ['q']);
    const r1 = withTriStateOutput(reg8(), ['q']);
    const r2 = withTriStateOutput(reg8(), ['q']);
    const r3 = withTriStateOutput(reg8(), ['q']);
    const r4 = withTriStateOutput(reg8(), ['q']);
    const r5 = withTriStateOutput(reg8(), ['q']);
    // memory address register high byte
    const mh = withTriStateOutput(counterReg(8), ['q']);
    // memory address register low byte
    const ml = withTriStateOutput(counterReg(8), ['q']);

    mh.in.countEnable = ml.out.carryOut;

    IO.forward({ clk, rst }, [r0, r1, r2, r3, r4, r5, mh, ml]);
  }
});