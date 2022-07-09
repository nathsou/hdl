import { defineModule, IO } from '../src/core';
import { counterReg, reg8 } from '../src/modules/regs';
import { withTriStateOutput } from '../src/modules/tristate';

const createCPU = defineModule({
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