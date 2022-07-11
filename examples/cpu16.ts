import { defineModule, IO, Multi, State } from "../src/core";
import { add, adder, isEqualConst, shiftLeft, shiftRight } from "../src/modules/arith";
import { and, land, lnot, lor, nand, or, xor } from "../src/modules/gates";
import { decoder, match, matchWithDefault, mux2 } from "../src/modules/mux";
import { reg, reg16 } from "../src/modules/regs";
import { triStateBuffer } from "../src/modules/tristate";
import { createSimulator } from '../src/sim/sim';
import { Range, Tuple } from "../src/utils";

// 16-bit load-store CPU

const { bin } = Tuple;

enum Inst {
  ctrl = 0, // sel: 00 -> halt
  load, // r[dst] = mem[r[addr] + offset]
  store, // mem[r[addr] + offset] = r[src]
  set, // r[dst] = <const> (10 bits)
  arith, // r[dst] = r[op1] (op) r[op2] (sel: 00 -> add, 01 -> sub, 10 -> adc, 11 -> sbc)
  cond, // r[dst] = r[op1] (op) r[op2] (sel: 00 -> add, 01 -> sub, 10 -> adc, 11 -> sbc) (00xx -> if z, 01xx -> if not z, 10xx -> if c, 11xx -> if not c)
  logic, // r[dst] = r[op1] (op) r[op2] (sel: 000 -> and, 001 -> or, 010 -> nand, 011 -> xor, 100 -> shl, 101 -> shr)
}

enum ArithOp { add = 0, sub, adc, sbc }
enum LogicOp { and = 0, or, nand, xor, shl, shr }
enum RegMapping { z = 0, r1, r2, r3, r4, tmp, sp, pc }
enum CtrlOp { halt = 0 }

enum Cond {
  ifZeroSet = 0,
  ifZeroNotSet,
  ifCarrySet,
  ifCarryNotSet,
}

const createROM = (rom: Uint16Array) => defineModule({
  name: 'instructions_rom',
  inputs: { clk: 1, addr: 16 },
  outputs: { inst: 16 },
  state: { addr: 0, lastClk: State.zero },
  simulate({ clk, addr }, out, state) {
    const rising = clk === 1 && state.lastClk === 0;

    if (rising) {
      state.addr = parseInt(addr.join(''), 2);
    }

    out.inst = bin(rom[state.addr], 16);

    state.lastClk = clk;
  }
})();

const createRAM = (ram: Uint16Array) => defineModule({
  name: 'ram',
  inputs: { clk: 1, rst: 1, d: 16, read: 1, write: 1, addr: 16 },
  outputs: { q: 16 },
  state: { lastClk: State.zero },
  simulate(inp, out, state) {
    const rising = inp.clk === 1 && state.lastClk === 0;

    if (inp.rst === 1) {
      ram.fill(0);
    }

    let addr = parseInt(inp.addr.join(''), 2);

    if (!isNaN(addr)) {
      if (rising && inp.write === 1) {
        ram[addr] = parseInt(inp.d.join(''), 2);
      }

      if (inp.read === 1 || inp.write === 1) {
        out.q = bin(ram[addr], 16);
      }
    }

    state.lastClk = inp.clk;
  }
})();

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
  inputs: { d: 16, clk: 1, rst: 1, load: 1, dest: 3, src1: 3, src2: 3 },
  outputs: { a: 16, b: 16, regs: 112 },
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
      regs[n].in.d = inp.d;
      regs[n].in.load = land(selDst[n], inp.load);

      buffersA[n].in.d = regs[n].out.q;
      buffersB[n].in.d = regs[n].out.q;
      buffersA[n].in.enable = selA[n];
      buffersB[n].in.enable = selB[n];

      out.a = buffersA[n].out.q;
      out.b = buffersB[n].out.q;
    });

    out.regs = [
      ...regs[1].out.q,
      ...regs[2].out.q,
      ...regs[3].out.q,
      ...regs[4].out.q,
      ...regs[5].out.q,
      ...regs[6].out.q,
      ...regs[7].out.q,
    ];
  }
});

const createALU = defineModule({
  name: 'alu',
  inputs: { a: 16, b: 16, op: 3, isLogic: 1, carryIn: 1, outputEnable: 1 },
  outputs: { q: 16, isZero: 1, carryOut: 1 },
  connect({ a, b, op, isLogic, carryIn, outputEnable }) {
    const adders = adder(16);
    const outputBuffer = triStateBuffer(16);
    const outputMux = mux2(16);
    // arithmetic unit
    const [_isAdd, isSub, isAdc, isSbc] = decoder(4, Tuple.slice(op, 1, 3));
    const subtract = lor(isSub, isSbc);
    adders.in.a = a;
    adders.in.b = xor(b, Tuple.repeat(16, subtract));
    adders.in.carryIn = lor(isSub, lor(land(isAdc, carryIn), land(isSbc, lnot(carryIn))));

    // logic unit
    const logicOutput = matchWithDefault(op, {
      [LogicOp.and]: and(a, b),
      [LogicOp.or]: or(a, b),
      [LogicOp.nand]: nand(a, b),
      [LogicOp.xor]: xor(a, b),
      [LogicOp.shl]: shiftLeft<16>(a, Tuple.slice(b, 12, 16)),
      [LogicOp.shr]: shiftRight<16>(a, Tuple.slice(b, 12, 16)),
      _: Tuple.repeat(16, 0),
    });

    outputMux.in.d0 = adders.out.sum;
    outputMux.in.d1 = logicOutput;
    outputMux.in.sel = isLogic;

    outputBuffer.in.d = outputMux.out.q;
    outputBuffer.in.enable = outputEnable;

    return {
      q: outputBuffer.out.q,
      isZero: isEqualConst(bin(0, 16), outputMux.out.q),
      carryOut: adders.out.carryOut,
    };
  }
});

const createLoadStore = (Ram: Uint16Array) => defineModule({
  name: 'load_store',
  inputs: { clk: 1, rst: 1, isLoad: 1, isStore: 1, addr: 16, d: 16, offsetLow: 4, offsetHigh1: 3, offsetHigh2: 3 },
  outputs: { q: 16 },
  connect(inp) {
    const ram = createRAM(Ram);

    IO.forward({ clk: inp.clk, rst: inp.rst }, [ram]);

    const offsetHigh = match(inp.isStore, {
      0: inp.offsetHigh1,
      1: inp.offsetHigh2,
    });
    const offset: IO<7> = [...offsetHigh, ...inp.offsetLow];
    const offsetAddr = add<16>(inp.addr, [0, 0, 0, 0, 0, 0, 0, 0, 0, ...offset]);

    ram.in.d = inp.d;
    ram.in.addr = offsetAddr;
    ram.in.read = inp.isLoad;
    ram.in.write = inp.isStore;

    const outputBuffer = triStateBuffer(16);
    outputBuffer.in.d = ram.out.q;
    outputBuffer.in.enable = inp.isLoad;

    return { q: outputBuffer.out.q };
  }
})();

const createCPU = (Rom: Uint16Array, Ram: Uint16Array) => defineModule({
  name: 'cpu',
  inputs: { clk: 1, rst: 1 },
  outputs: { z: 1, c: 1, inst: 16, halted: 1, regs: 112 },
  connect(inp) {
    const flags = reg(3);
    const rom = createROM(Rom);
    const regs = createRegisters();
    const alu = createALU();
    const setBuffer = triStateBuffer(16);
    const loadStore = createLoadStore(Ram);
    const pc = Tuple.slice(regs.out.regs, 96, 112);

    rom.in.clk = lnot(inp.clk);
    rom.in.addr = pc;
    const inst = rom.out.inst;
    const opcode = Tuple.slice(inst, 0, 3);
    const dest = Tuple.slice(inst, 3, 6);
    const src1 = Tuple.slice(inst, 6, 9);
    const src2 = Tuple.slice(inst, 9, 12);
    const sel = Tuple.slice(inst, 12, 16);

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

    const shouldBranch = match(Tuple.slice(sel, 0, 2), {
      [Cond.ifZeroSet]: zeroFlag,
      [Cond.ifZeroNotSet]: lnot(zeroFlag),
      [Cond.ifCarrySet]: carryFlag,
      [Cond.ifCarryNotSet]: lnot(carryFlag),
    });

    loadStore.in.clk = inp.clk;
    loadStore.in.rst = inp.rst;
    loadStore.in.addr = regs.out.a;
    loadStore.in.d = regs.out.b;
    loadStore.in.offsetHigh1 = src2;
    loadStore.in.offsetHigh2 = dest;
    loadStore.in.offsetLow = Tuple.slice(inst, 12, 16);
    loadStore.in.isLoad = isLoad;
    loadStore.in.isStore = isStore;

    alu.in.op = Tuple.slice(sel, 1, 4);
    alu.in.isLogic = isLogic;
    alu.in.a = regs.out.a;
    alu.in.b = regs.out.b;
    alu.in.carryIn = carryFlag;
    alu.in.outputEnable = opcode[0]; // <=> or(isArith, isCond, isLogic)

    setBuffer.in.enable = isSet;
    setBuffer.in.d = [0, 0, 0, 0, 0, 0, ...Tuple.slice(inst, 6, 16)];

    // registers input
    regs.in.d = alu.out.q;
    regs.in.d = setBuffer.out.q;
    regs.in.d = loadStore.out.q;

    const isBranchingCond = land(isCond, shouldBranch);

    regs.in.load = lor(isLoad, isSet, isArith, isLogic, isBranchingCond);

    flags.in.load = lor(isCtrl, isArith, isLogic, isBranchingCond);
    flags.in.rst = inp.rst;
    flags.in.clk = inp.clk;
    flags.in.d[0] = alu.out.isZero;
    flags.in.d[1] = alu.out.carryOut;
    flags.in.d[2] = isCtrl;

    return {
      inst,
      z: zeroFlag,
      c: carryFlag,
      halted: haltedFlag,
      regs: regs.out.regs,
    };
  }
})();

const showInst = (inst: number) => {
  const opcode = (inst >> 13) & 0x7;
  const dest = (inst >> 10) & 0x7;
  const src1 = (inst >> 7) & 0x7;
  const src2 = (inst >> 4) & 0x7;
  const constant = inst & 0x3ff; // 10 bits
  const sel = inst & 0xf;

  const rrr = () => `${RegMapping[dest]} ${RegMapping[src1]} ${RegMapping[src2]}`;

  switch (opcode) {
    case Inst.ctrl:
      switch (sel) {
        case CtrlOp.halt:
          return 'halt';
        default:
          throw new Error(`Unknown control operation: ${sel}`);
      }
    case Inst.load: return `load ${RegMapping[dest]} ${RegMapping[src1]} ${inst & 0b1111111}`;
    case Inst.store: return `store ${RegMapping[src2]} ${RegMapping[src1]} ${(dest << 4 | (inst & 0b1111))}`;
    case Inst.set: return `set ${RegMapping[dest]} ${constant}`;
    case Inst.arith: return `${ArithOp[sel]} ${rrr()}`;
    case Inst.cond: {
      const op = sel & 0b11;
      const cond = (sel >> 2) & 0b11;

      const condName: Record<number, string> = {
        [Cond.ifZeroSet]: 'z',
        [Cond.ifZeroNotSet]: 'nz',
        [Cond.ifCarrySet]: 'c',
        [Cond.ifCarryNotSet]: 'nc',
      };

      return `${ArithOp[op]}(${condName[cond]}) ${rrr()}`;
    }
    case Inst.logic: return `${LogicOp[sel]} ${rrr()}`;
  }
};

const main = () => {
  const rom = new Uint16Array(2 ** 16);
  // solve euler pb 2
  rom.set([
    0x6409, 0x7408, 0xc4d4, 0xc481, 0x4019, 0x643d, 0x4018, 0x7401, 0x4051, 0x7402, 0x4053, 0x4057,
    0x2c02, 0x3003, 0x4034, 0x4045, 0x2400, 0x2801, 0x9140, 0x8cb2, 0x4032, 0x4043, 0x2404, 0x2805,
    0x4010, 0x4021, 0x3003, 0x7401, 0xc250, 0x7407, 0xbfd4, 0x2c02, 0x2406, 0x2807, 0x8940, 0x84b2,
    0x4016, 0x4027, 0x2408, 0x2809, 0x8941, 0x84b3, 0x7420, 0xbfd9, 0x2406, 0x2807, 0x0000
  ], 0);
  const ram = new Uint16Array(2 ** 16);
  const cpu = createCPU(rom, ram);

  const sim = createSimulator(cpu);

  const logState = () => {
    const regs = sim.state.read(cpu.out.regs);
    const r1 = regs.slice(0, 16);
    const r2 = regs.slice(16, 32);
    const r3 = regs.slice(32, 48);
    const r4 = regs.slice(48, 64);
    const r5 = regs.slice(64, 80);
    const r6 = regs.slice(80, 96);
    const pc = regs.slice(96, 112);
    const z = sim.state.read(cpu.out.z);
    const c = sim.state.read(cpu.out.c);
    const inst = sim.state.read(cpu.out.inst);
    const opcode = showInst(parseInt(inst.join(''), 2));

    const fmt = (n: State | State[]) => (
      (n: State[]) => n.includes('x') ? 'xxxx' : parseInt(n.join(''), 2).toString(16).padStart(4, '0')
    )(Array.isArray(n) ? n : [n]);

    const values = { r1, r2, r3, r4, r5, r6, pc };
    console.log(Object.entries(values).map(([k, v]) => `${k}: ${fmt(v)}`).join(', ') + `, z: ${z}, c: ${c}, ${opcode}`);
  };

  let halted = sim.state.read(cpu.out.halted);

  while (halted !== 1) {
    sim.input({ clk: 0, rst: 0 });
    sim.input({ clk: 1, rst: 0 });
    logState();
    halted = sim.state.read(cpu.out.halted);
  }

  console.log('ram[0:15] =', Array.from(ram.slice(0, 16)).map(n => n.toString(16).padStart(4, '0')).join(' '));
};

main();