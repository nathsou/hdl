import { defineModule, IO, Module, Multi, State } from "../src/core";
import { adder, isEqualConst, shiftLeft, shiftRight } from "../src/modules/arith";
import { and, logicalAnd, logicalNot, logicalOr, nand, or, xor } from "../src/modules/gates";
import { decoder, match1, match16, mux2 } from "../src/modules/mux";
import { reg16, reg } from "../src/modules/regs";
import { triStateBuffer } from "../src/modules/tristate";
import { createSimulator } from '../src/sim/sim';
import { Range, Tuple } from "../src/utils";

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

export enum Cond {
  ifZeroSet = 0,
  ifZeroNotSet,
  ifCarrySet,
  ifCarryNotSet,
}

const createROM = defineModule({
  name: 'instructions_rom',
  inputs: { address: 16 },
  outputs: { inst: 16 },
  connect({ address }, out) {
    out.inst = match16(address, {
      0: bin(0x6801, 16),
      1: bin(0x70ff, 16),
      2: bin(0x84a0, 16),
      3: bin(0x80c1, 16),
      4: bin(0x7404, 16),
      5: bin(0xbfd5, 16),
      6: bin(0x0000, 16),
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

let regs: Module<{
  d: 16;
  load: 1;
  clk: 1;
  rst: 1;
}, {
  q: 16;
}>[] = [];

const createRegisters = defineModule({
  name: 'registers',
  inputs: { d: 16, clk: 1, rst: 1, load: 1, dest: 3, src1: 3, src2: 3 },
  outputs: { a: 16, b: 16, pc: 16 },
  connect(inp, out) {
    const pc = createProgramCounter(16);
    regs = [...Tuple.gen(7, reg16), pc];
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
      regs[n].in.d = inp.d;
      regs[n].in.load = logicalAnd(selDst[n], inp.load);

      buffersA[n].in.d = regs[n].out.q;
      buffersB[n].in.d = regs[n].out.q;
      buffersA[n].in.enable = selA[n];
      buffersB[n].in.enable = selB[n];

      out.a = buffersA[n].out.q;
      out.b = buffersB[n].out.q;
    });

    out.pc = pc.out.q;
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
    // arithmetic unit
    const [_isAdd, isSub, isAdc, isSbc] = decoder(4, Tuple.slice(1, 3, op));
    const subtract = logicalOr(isSub, isSbc);
    const useCarry = logicalOr(isAdc, isSbc);
    adders.in.a = a;
    adders.in.b = xor<16>(b, Tuple.repeat(16, subtract));
    adders.in.carryIn = logicalOr(isSub, logicalAnd(useCarry, carryIn));

    // logic unit
    const logicOutput = match16(op, {
      [LogicOp.and]: and<16>(a, b),
      [LogicOp.or]: or<16>(a, b),
      [LogicOp.nand]: nand<16>(a, b),
      [LogicOp.xor]: xor<16>(a, b),
      [LogicOp.shl]: shiftLeft<16>(a, Tuple.slice(12, 16, b)),
      [LogicOp.shr]: shiftRight<16>(a, Tuple.slice(12, 16, b)),
      _: Tuple.repeat(16, 0),
    });

    outputMux.in.d0 = adders.out.sum;
    outputMux.in.d1 = logicOutput;
    outputMux.in.sel = isLogic;

    outputBuffer.in.d = outputMux.out.q;
    outputBuffer.in.enable = outputEnable;

    out.q = outputBuffer.out.q;
    out.isZero = isEqualConst(bin(0, 16), outputMux.out.q);
    out.carryOut = adders.out.carryOut;
  }
});

const createCPU = defineModule({
  name: 'cpu',
  inputs: { clk: 1, rst: 1 },
  outputs: { z: 1, c: 1, inst: 16, halted: 1 },
  connect(inp, out) {
    const flags = reg(3);
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

    const zeroFlag = flags.out.q[0];
    const carryFlag = flags.out.q[1];
    const haltedFlag = flags.out.q[2];

    const shouldBranch = match1(Tuple.slice(0, 2, sel), {
      [Cond.ifZeroSet]: zeroFlag,
      [Cond.ifZeroNotSet]: logicalNot(zeroFlag),
      [Cond.ifCarrySet]: carryFlag,
      [Cond.ifCarryNotSet]: logicalNot(carryFlag),
    });

    alu.in.op = Tuple.slice(1, 4, sel);
    alu.in.isLogic = isLogic;
    alu.in.a = regs.out.a;
    alu.in.b = regs.out.b;
    alu.in.carryIn = 0;
    alu.in.outputEnable = logicalOr(isArith, isCond, isLogic);

    setBuffer.in.enable = isSet;
    setBuffer.in.d = [0, 0, 0, 0, 0, 0, ...Tuple.slice(6, 16, inst)];

    // registers input
    regs.in.d = alu.out.q;
    regs.in.d = setBuffer.out.q;

    const isBranchingCond = logicalAnd(isCond, shouldBranch);

    regs.in.load = logicalOr(isLoad, isSet, isArith, isLogic, isBranchingCond);

    flags.in.load = logicalOr(isCtrl, isArith, isBranchingCond);
    flags.in.rst = inp.rst;
    flags.in.clk = inp.clk;
    flags.in.d[0] = alu.out.isZero;
    flags.in.d[1] = alu.out.carryOut;
    flags.in.d[2] = isCtrl;

    out.inst = inst;
    out.z = zeroFlag;
    out.c = carryFlag;
    out.halted = haltedFlag;
  }
});

const main = async () => {
  const cpu = createCPU();

  const sim = createSimulator(cpu, {
    approach: 'event-driven',
    checkConnections: true,
  });

  const logState = () => {
    const r1 = sim.state.read(regs[1].out.q);
    const r2 = sim.state.read(regs[2].out.q);
    const r3 = sim.state.read(regs[3].out.q);
    const r4 = sim.state.read(regs[4].out.q);
    const r5 = sim.state.read(regs[5].out.q);
    const r6 = sim.state.read(regs[6].out.q);
    const pc = sim.state.read(regs[7].out.q);
    const z = sim.state.read(cpu.out.z);
    const c = sim.state.read(cpu.out.c);
    const inst = sim.state.read(cpu.out.inst);
    const opcode = Inst[parseInt(inst.join(''), 2) >> 13];

    const fmt = (n: State | State[]) => (
      (n: State[]) => n.includes('x') ? 'xxxx' : parseInt(n.join(''), 2).toString(16).padStart(4, '0')
    )(Array.isArray(n) ? n : [n]);

    const values = { r1, r2, r3, r4, r5, r6, pc, z, c, inst };
    console.log(Object.entries(values).map(([k, v]) => `${k}: ${fmt(v)}`).join(', ') + ', op: ' + opcode);
  };

  let halted = sim.state.read(cpu.out.halted);

  while (halted !== 1) {
    sim.input({ clk: 0, rst: 0 });
    // logState();
    sim.input({ clk: 1, rst: 0 });
    logState();
    halted = sim.state.read(cpu.out.halted);
  }
};

main();