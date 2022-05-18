import { compare8 } from "../src";
import { Connection, IO, State, createModule } from "../src/core";
import { demux16, match8, matchN, match1 } from "../src/modules/mux";
import { adder, add, subtract, shiftLeft, shiftRight, isEqual, isEqualConst } from "../src/modules/arith";
import { reg8 } from "../src/modules/regs";
import { and, or, not, xor } from "../src/modules/gates";
import { createSimulator } from '../src/sim/sim';
import { Tuple, Range } from "../src/utils";

const { bin } = Tuple;

// Based on the basic CPU architecture from https://alchitry.com/basic-cpu-mojo
const Inst = {
  NOOP: 0x0,
  LOAD: 0x1,
  STORE: 0x2,
  SET: 0x3,
  LT: 0x4,
  EQ: 0x5,
  BEQ: 0x6,
  BNEQ: 0x7,
  ADD: 0x8,
  SUB: 0x9,
  SHL: 0xa,
  SHR: 0xb,
  AND: 0xc,
  OR: 0xd,
  INV: 0xe,
  XOR: 0xf,
} as const;

const createROM = createModule({
  name: 'instructions_rom',
  inputs: { address: 8 },
  outputs: { inst: 16 },
  connect({ address }, out) {
    out.inst = matchN(16)(address, {
      0: [...bin(Inst.SET, 4), ...bin(2, 4), ...bin(0, 8)],
      // loop
      1: [...bin(Inst.SET, 4), ...bin(1, 4), ...bin(128, 8)],
      2: [...bin(Inst.STORE, 4), ...bin(2, 4), ...bin(1, 4), ...bin(0, 4)],
      3: [...bin(Inst.SET, 4), ...bin(1, 4), ...bin(1, 8)],
      4: [...bin(Inst.ADD, 4), ...bin(2, 4), ...bin(2, 4), ...bin(1, 4)],
      5: [...bin(Inst.SET, 4), ...bin(15, 4), ...bin(1, 8)],
      6: [...bin(Inst.SET, 4), ...bin(0, 4), ...bin(7, 8)],
      // delay
      7: [...bin(Inst.SET, 4), ...bin(11, 4), ...bin(0, 8)],
      8: [...bin(Inst.SET, 4), ...bin(1, 4), ...bin(1, 8)],
      // delay_loop
      9: [...bin(Inst.ADD, 4), ...bin(11, 4), ...bin(11, 4), ...bin(1, 4)],
      10: [...bin(Inst.BEQ, 4), ...bin(11, 4), ...bin(0, 8)],
      11: [...bin(Inst.SET, 4), ...bin(0, 4), ...bin(9, 8)],
      12: [...bin(Inst.SET, 4), ...bin(1, 4), ...bin(0, 8)],
      13: [...bin(Inst.ADD, 4), ...bin(0, 4), ...bin(15, 4), ...bin(1, 4)],
      _: Tuple.repeat(16, 0),
    });
  }
});

const top = createModule({
  name: 'top',
  inputs: { din: 8, clk: 1 },
  outputs: { read: 1, write: 1, address: 8, dout: 8 },
  connect(inp, out) {
    const regs = Tuple.gen(16, i => reg8(bin(i, 8)));
    const rom = createROM();

    IO.forward({ clk: inp.clk }, regs);

    const programCounter = regs[0].out.q;
    rom.in.address = programCounter;

    const inst = rom.out.inst;
    const opcode = Tuple.slice(0, 4, inst);
    const dest = Tuple.slice(4, 8, inst);
    const arg1 = Tuple.slice(8, 12, inst);
    const arg2 = Tuple.slice(12, 16, inst);
    const constant = Tuple.slice(8, 16, inst);

    const registersMapping = Object.fromEntries(
      regs.map((r, i) => [i, r.out.q])
    ) as Record<Range<0, 16>, Tuple<Connection, 8>>;

    const destRegOut = match8(dest, registersMapping);
    const arg1RegOut = match8(arg1, registersMapping);
    const arg2RegOut = match8(arg2, registersMapping);

    const argsComp = compare8(arg1RegOut, arg2RegOut);

    const inputDemux = demux16(8);
    inputDemux.in.sel = dest;

    inputDemux.in.d = match8(opcode, {
      [Inst.LOAD]: inp.din,
      [Inst.SET]: constant,
      [Inst.LT]: Tuple.repeat(8, argsComp.lss),
      [Inst.EQ]: Tuple.repeat(8, argsComp.equ),
      [Inst.ADD]: add<8>(arg1RegOut, arg2RegOut),
      [Inst.SUB]: subtract<8>(arg1RegOut, arg2RegOut),
      [Inst.SHL]: shiftLeft<8>(arg1RegOut, Tuple.low(3, arg2RegOut)),
      [Inst.SHR]: shiftRight<8>(arg1RegOut, Tuple.low(3, arg2RegOut)),
      [Inst.AND]: and<8>(arg1RegOut, arg2RegOut),
      [Inst.OR]: or<8>(arg1RegOut, arg2RegOut),
      [Inst.INV]: not<8>(arg1RegOut),
      [Inst.XOR]: xor<8>(arg1RegOut, arg2RegOut),
      _: Tuple.repeat(8, State.zero),
    });

    const isDestZero = isEqualConst<4>(bin(0, 4), dest);
    const isStoreInst = isEqualConst<4>(bin(Inst.STORE, 4), opcode);
    const isLoadInst = isEqualConst<4>(bin(Inst.LOAD, 4), opcode);
    const isBeqInst = isEqualConst<4>(bin(Inst.BEQ, 4), opcode);
    const isBneqInst = isEqualConst<4>(bin(Inst.BNEQ, 4), opcode);
    const destOutEqualsConstant = isEqual<8>(destRegOut, constant);

    out.address = add<8>(arg1RegOut, [0, 0, 0, 0, ...arg2]);
    out.dout = destRegOut;
    out.read = isLoadInst;
    out.write = isStoreInst;

    const pcIncrementer = adder(8);
    pcIncrementer.in.carryIn = 0;
    pcIncrementer.in.a = programCounter;

    const branch = or(
      and(destOutEqualsConstant, isBeqInst),
      and(not(destOutEqualsConstant), isBneqInst)
    );
    pcIncrementer.in.b = match8(branch, {
      0: Tuple.bin(1, 8),
      1: Tuple.bin(2, 8),
    });

    regs[0].in.load = 1;
    regs[0].in.d = match8(isDestZero, {
      0: pcIncrementer.out.sum,
      1: inputDemux.out.q0,
    });

    const loadDemux = demux16(1);
    loadDemux.in.sel = dest;
    loadDemux.in.d = match1(opcode, {
      [Inst.NOOP]: 0,
      [Inst.STORE]: 0,
      [Inst.BEQ]: 0,
      [Inst.BNEQ]: 0,
      _: 1,
    });

    Range.iter(1, 16, n => {
      regs[n].in.load = loadDemux.out[`q${n}`];
      regs[n].in.d = inputDemux.out[`q${n}`];
    });
  },
});

const main = () => {
  const mod = top();
  const sim = createSimulator(mod);
  const din = Tuple.repeat(8, State.zero);

  for (let i = 0; i < 198914; i++) {
    sim.input({ din, clk: 0 });
    if (sim.state.read(mod.out.write) === 1) {
      console.log({
        dout: sim.state.read(mod.out.dout).join(''),
      });
    }
    sim.input({ din, clk: 1 });
  }
};

main();