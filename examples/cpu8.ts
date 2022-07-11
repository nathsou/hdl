import { adderSubtractor, bidirectionalShifter, decoder, land, match, nand, nor, Range, Tuple } from '../src';
import { defineModule, IO } from '../src/core';
import { counterReg, reg8 } from '../src/modules/regs';
import { triStateBuffer } from '../src/modules/tristate';

enum Regs { r0 = 0, r1, r2, r3, r4, r5, mh, ml }
enum AluOp { add = 0, shift, nand, nor }

const Registers = defineModule({
  name: 'regs',
  inputs: { clk: 1, rst: 1, d: 8, selDst: 3, selA: 3, selB: 3, incPC: 1, load: 1 },
  outputs: { a: 8, b: 8 },
  connect({ clk, rst, d, selDst, selA, selB, incPC, load }, out) {
    const regs = [
      ...Tuple.gen(6, reg8), // general purpose registers
      ...Tuple.gen(2, () => counterReg(8)), // memory address register
    ] as const;

    IO.forward({ clk, rst }, regs);

    const buffersA = Tuple.gen(8, () => triStateBuffer(8));
    const buffersB = Tuple.gen(8, () => triStateBuffer(8));

    const selADecoder = decoder(8, selA);
    const selBDecoder = decoder(8, selB);
    const selDestDecoder = decoder(8, selDst);

    Range.iter(0, 8, n => {
      regs[n].in.d = d;
      regs[n].in.load = land(selDestDecoder[n], load);

      buffersA[n].in.enable = selADecoder[n];
      buffersB[n].in.enable = selBDecoder[n];

      buffersA[n].in.d = regs[n].out.q;
      buffersB[n].in.d = regs[n].out.q;

      out.a = buffersA[n].out.q;
      out.b = buffersB[n].out.q;
    });

    regs[Regs.mh].in.countEnable = regs[Regs.ml].out.carryOut;
    regs[Regs.ml].in.countEnable = incPC;
  }
});

// op: 00 -> add, 01 -> shift, 10 -> nand, 11 -> nor
const ALU = defineModule({
  name: 'alu',
  inputs: { op: 2, a: 8, b: 8, carryIn: 1, subtract: 1, shiftDir: 1 },
  outputs: { q: 8 },
  connect({ op, a, b, carryIn, subtract, shiftDir }) {
    const adder = adderSubtractor(8);

    adder.in.a = a;
    adder.in.b = b;
    adder.in.carryIn = carryIn;
    adder.in.subtract = subtract;

    const shifter = bidirectionalShifter(8);
    shifter.in.dir = shiftDir;
    shifter.in.d = a;

    return {
      q: match(op, {
        [AluOp.add]: adder.out.sum,
        [AluOp.shift]: shifter.out.q,
        [AluOp.nand]: nand(a, b),
        [AluOp.nor]: nor(a, b),
      }),
    };
  }
});

const CPU = defineModule({
  name: 'cpu',
  inputs: { clk: 1, rst: 1 },
  outputs: {},
  connect({ clk, rst }) {
    const regs = Registers();
    const alu = ALU();

    IO.forward({ clk, rst }, [regs]);
  }
});