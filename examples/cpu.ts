import { adder, and, isEqualConst, logicalAnd, logicalOr, nand, or, xor } from "../src";
import { defineModule, IO, Multi, State } from "../src/core";
import { decoder, match16, mux2, mux8 } from "../src/modules/mux";
import { reg16 } from "../src/modules/regs";
import { triStateBuffer } from "../src/modules/tristate";
import { createSimulator } from '../src/sim/sim';
import { last, Range, Tuple } from "../src/utils";

const { bin } = Tuple;

export enum Inst {
  ctrl = 0, // sel: 00 -> halt
  load, // r[dst] = mem[r[addr] + offset]
  store, // mem[r[addr] + offset] = r[src]
  set, // r[dst] = <const> (10 bits)
  arith, // r[dst] = r[op1] (op) r[op2] (sel: 00 -> add, 01 -> sub, 10 -> adc, 11 -> sbc)
  cond, // r[dst] = r[op1] (op) r[op2] (sel: 00 -> add, 01 -> sub, 10 -> adc, 11 -> sbc) (00xx -> if z, 01xx -> if not z, 10xx -> if c, 11xx -> if not c)
  logic, // r[dst] = r[op1] (op) r[op2] (sel: 000 -> and, 001 -> or, 010 -> nand, 011 -> xor, 100 -> shl, 101 -> shr)
}

export enum LogicOp {
  and = 0,
  or,
  nand,
  xor,
  shl,
  shr,
}

const createROM = defineModule({
  name: 'instructions_rom',
  inputs: { address: 16 },
  outputs: { inst: 16 },
  connect({ address }, out) {
    out.inst = match16(address, {
      0: bin(0x6417, 16),
      1: bin(0x6803, 16),
      2: bin(0xc4a4, 16),
      3: bin(0x0000, 16),
      _: bin(0, 16),
    });
  }
});

const createProgramCounter = <N extends Multi>(N: N) => {
  const zero = State.gen(N, () => State.zero);

  return defineModule({
    name: `counter_reg${N}`,
    inputs: { d: N, load: 1, countEnable: 1, clk: 1, rst: 1 },
    outputs: { q: N },
    state: { bits: State.gen(N, () => State.zero), last_clk: State.zero },
    simulate(inp, out, state) {
      const rising = state.last_clk === 0 && inp.clk;

      if (inp.rst === 1) {
        state.bits = zero;
      } else if (rising) {
        if (inp.load) {
          state.bits = inp.d;
        }

        if (inp.countEnable) {
          for (let i = N - 1; i >= 0; i--) {
            const prev = state.bits[i];
            state.bits[i] = prev === 0 ? 1 : 0;
            if (prev !== 1) { break; }
          }
        }
      }

      state.last_clk = inp.clk;
      out.q = state.bits;
    },
  })();
};

const createRegisters = defineModule({
  name: 'registers',
  inputs: { d: 16, clk: 1, rst: 1, dest: 3, src1: 3, src2: 3 },
  outputs: { a: 16, b: 16, pc: 16 },
  connect(inp, out) {
    const pc = createProgramCounter(16);
    const regs = [...Tuple.gen(7, reg16), pc];
    const buffersA = Tuple.gen(8, () => triStateBuffer(16));
    const buffersB = Tuple.gen(8, () => triStateBuffer(16));
    const selDst = decoder(8, inp.dest);
    const selA = decoder(8, inp.src1);
    const selB = decoder(8, inp.src2);

    IO.forward({ clk: inp.clk, rst: inp.rst }, regs.slice(1));

    // rz is always 0
    regs[0].in.rst = 1;
    // always increment the program counter
    pc.in.countEnable = 1;

    Range.iter(0, 8, n => {
      buffersA[n].in.d = regs[n].out.q;
      buffersB[n].in.d = regs[n].out.q;
      regs[n].in.d = inp.d;
      regs[n].in.load = selDst[n];
      buffersA[n].in.enable = selA[n];
      buffersB[n].in.enable = selB[n];

      out.a = buffersA[n].out.q;
      out.b = buffersB[n].out.q;
    });

    out.pc = pc.out.q;
  }
});

const createShifter = defineModule({
  name: 'shifter',
  inputs: { n: 16, amount: 4, dir: 1 },
  outputs: { q: 16 },
  simulate(inp, out) {
    const n = parseInt(inp.n.join(''), 2);
    const amount = parseInt(inp.amount.join(''), 2);

    if (inp.dir === 0) {
      out.q = bin(n << amount, 16);
    } else {
      out.q = bin(n >>> amount, 16);
    }
  }
});

const createALU = defineModule({
  name: 'alu',
  inputs: { a: 16, b: 16, op: 3, isLogic: 1, carryIn: 1, outputEnable: 1 },
  outputs: { q: 16, isZero: 1, carryOut: 1 },
  connect({ a, b, op, isLogic, carryIn, outputEnable }, out) {
    const adders = adder(16);
    const outputBuffer = triStateBuffer(16);
    const outputMux = mux2(16);
    const shifter = createShifter();

    // arithmetic unit
    const [_isAdd, isSub, isAdc, isSbc] = decoder(4, Tuple.slice(1, 3, op));
    const subtract = logicalOr(isSub, isSbc);
    const useCarry = logicalOr(isAdc, isSbc);
    adders.in.a = a;
    adders.in.b = xor<16>(b, Tuple.repeat(16, subtract));
    adders.in.carryIn = logicalOr(isSub, logicalAnd(useCarry, carryIn));

    // logic unit
    shifter.in.n = a;
    shifter.in.amount = Tuple.slice(12, 16, b);
    shifter.in.dir = last(op);

    const logicOutput = match16(op, {
      [LogicOp.and]: and<16>(a, b),
      [LogicOp.or]: or<16>(a, b),
      [LogicOp.nand]: nand<16>(a, b),
      [LogicOp.xor]: xor<16>(a, b),
      [LogicOp.shl]: shifter.out.q,
      [LogicOp.shr]: shifter.out.q,
      // [LogicOp.shl]: shiftLeft<16>(a, Tuple.slice(12, 16, b)),
      // [LogicOp.shr]: shiftRight<16>(a, Tuple.slice(12, 16, b)),
      _: Tuple.repeat(16, 0),
    });

    outputMux.in.d0 = adders.out.sum;
    outputMux.in.d1 = logicOutput;
    outputMux.in.sel = isLogic;

    outputBuffer.in.d = outputMux.out.q;
    outputBuffer.in.enable = outputEnable;

    out.q = outputBuffer.out.q;
    out.carryOut = adders.out.carryOut;
    out.isZero = isEqualConst(bin(0, 16), outputMux.out.q);
  }
});

const createCPU = defineModule({
  name: 'cpu',
  inputs: { clk: 1, rst: 1 },
  outputs: { aluOut: 16, a: 16, b: 16, pc: 16, inst: 16 },
  connect(inp, out) {
    const rom = createROM();
    const regs = createRegisters();
    const alu = createALU();
    const setBuffer = triStateBuffer(16);

    rom.in.address = regs.out.pc;
    const inst = rom.out.inst;
    const opcode = Tuple.slice(0, 3, inst);
    const dest = Tuple.slice(3, 6, inst);
    const src1 = Tuple.slice(6, 9, inst);
    const src2 = Tuple.slice(9, 12, inst);
    const sel = Tuple.slice(12, 16, inst);

    IO.forward({
      clk: inp.clk, rst: inp.rst,
      dest, src1, src2,
    }, [regs]);

    const [
      isCtrl, isLoad, isStore, isSet,
      isArith, isCond, isLogic
    ] = decoder(8, opcode);

    alu.in.op = Tuple.slice(1, 4, sel);
    alu.in.isLogic = isLogic;
    alu.in.a = regs.out.a;
    alu.in.b = regs.out.b;
    alu.in.carryIn = 0;
    alu.in.outputEnable = logicalOr(isArith, isCond, isLogic);

    setBuffer.in.enable = isSet;
    setBuffer.in.d = [0, 0, 0, 0, 0, 0, ...Tuple.slice(6, 16, inst)];

    // // registers input
    regs.in.d = alu.out.q;
    regs.in.d = setBuffer.out.q;

    out.a = regs.out.a;
    out.b = regs.out.b;
    out.aluOut = alu.out.q;
    out.pc = regs.out.pc;
    out.inst = inst;
  }
});

const main = async () => {
  const cpu = createCPU();

  const sim = createSimulator(cpu, {
    approach: 'event-driven',
    checkConnections: false,
  });

  const logState = () => {
    const a = sim.state.read(cpu.out.a);
    const b = sim.state.read(cpu.out.b);
    const pc = sim.state.read(cpu.out.pc);
    const aluOut = sim.state.read(cpu.out.aluOut);
    const inst = sim.state.read(cpu.out.inst);

    const fmt = (n: State[]) => n.includes('x') ? 'xxxx' : parseInt(n.join(''), 2).toString(16).padStart(4, '0');
    const values = { a, b, alu: aluOut, pc, inst };
    console.log(Object.entries(values).map(([k, v]) => `${k}: ${fmt(v)}`).join(', '));
  };

  for (let i = 0; i < 3; i++) {
    sim.input({ clk: 0, rst: 0 });
    logState();
    sim.input({ clk: 1, rst: 0 });
    logState();
  }
};

main();