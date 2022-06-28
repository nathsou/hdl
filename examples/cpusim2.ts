
const Inst = {
  NOP: 0x0,
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

const revInst = Object.fromEntries(
  Object.entries(Inst).map(([k, v]) => [v, k])
);

type Inst = typeof Inst;

const createCPU = (rom: Uint16Array, ram: Uint8Array) => {
  const regs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  const opDecoder: Record<number, (a: number, b: number) => number> = {
    0: (a: number, b: number) => (a + b) & 0xff,
    1: (a: number, b: number) => (a - b) & 0xff,
    2: (a: number, b: number) => (a << b) & 0xff,
    3: (a: number, b: number) => (a >> b) & 0xff,
    4: (a: number, b: number) => a & b,
    5: (a: number, b: number) => a | b,
    6: (a: number, _b: number) => ~a,
    7: (a: number, b: number) => a ^ b,
  };

  return () => {
    const inst = rom[regs[0]];
    const inst_hi = inst >> 8;
    const inst_lo = inst & 0xff;
    const opcode = (inst_hi >> 4) & 0xf;
    const dest = inst_hi & 0xf;
    const arg1 = (inst_lo >> 4) & 0xf;
    const arg2 = inst_lo & 0xf;
    const constant = inst_lo;

    let pc_increment =
      (opcode === Inst.BEQ && regs[dest] === constant) ||
        (opcode === Inst.BNEQ && regs[dest] !== constant) ? 2 : dest === 0 ? 0 : 1;

    // console.log(regs[0], revInst[opcode], dest, arg1, arg2, regs.map((r, i) => `R${i}:${r}`).join(','));

    const load_dest = opcode !== Inst.STORE && opcode !== Inst.BEQ && opcode !== Inst.BNEQ;
    const alu_active = (opcode & 0x8) !== 0;

    if (load_dest) {
      regs[dest] = alu_active ? opDecoder[opcode & 0x7](regs[arg1], regs[arg2]) : {
        [Inst.LOAD]: ram[regs[arg1] + arg2],
        [Inst.SET]: constant,
        [Inst.LT]: Number(regs[arg1] < regs[arg2]),
        [Inst.EQ]: Number(regs[arg1] === regs[arg2]),
      }[opcode] as number;
    }

    if (opcode === Inst.STORE) {
      ram[regs[arg1] + arg2] = regs[dest];
    }

    regs[0] += pc_increment;
  };
};

const encodeInst = (opcode: number, dest: number, arg1: number, arg2: number): number => {
  return (opcode << 12) | (dest << 8) | (arg1 << 4) | arg2;
};

const byte = (n: number): [number, number] => [(n >> 4) & 0xf, n & 0xf];

const rom = new Uint16Array([
  // begin:
  [Inst.SET, 2, ...byte(0)],
  // loop:
  [Inst.SET, 1, ...byte(128)],
  [Inst.STORE, 2, 1, 0],
  [Inst.SET, 1, ...byte(1)],
  [Inst.ADD, 2, 2, 1],
  [Inst.SET, 15, ...byte(1)],
  [Inst.SET, 0, ...byte(7)], // goto delay
  // delay:
  [Inst.SET, 11, ...byte(0)],
  [Inst.SET, 1, ...byte(1)],             // SET R1, 1
  // delay_loop:
  [Inst.ADD, 11, 11, 1],      // ADD R11, R11, R1
  [Inst.BEQ, 11, ...byte(0)],            // BEQ R11, 0
  [Inst.SET, 0, ...byte(9)],            // SET R0, delay_loop
  [Inst.SET, 1, ...byte(0)],            // R1 = 0
  [Inst.ADD, 0, 15, 1],       // ADD R0, R15, R1
].map(([a, b, c, d]) => encodeInst(a, b, c, d)));

const main = () => {
  const ram = new Uint8Array(0xff);
  const step = createCPU(rom, ram);
  let lastValue = 0;
  let changes = 0;

  for (let i = 0; i < 1_000_000; i++) {
    step();
    if (ram[128] !== lastValue) {
      lastValue = ram[128];
      // console.log(ram[128]);
      changes++;
    }
  }

  console.log(changes);
};

main();