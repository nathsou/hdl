import { Connection, createModule, Module } from "../core";
import { logicalAnd, logicalNand, logicalNot, logicalOr, logicalXnor, logicalXor } from "./gates";
import { adder } from './arith';
import { Tuple } from "../utils";

// https://en.wikipedia.org/wiki/List_of_7400-series_integrated_circuits

const defaultFootprint = (n: number) => `Package_DIP:DIP-${n}_W7.62mm_Socket`;

const create74xQuadLogicalGatesModule = (id: string, gate: (a: Connection, b: Connection) => Connection) => {
  return (footprint = defaultFootprint(14)) => createModule({
    name: `74x${id}`,
    inputs: { gnd: 1, vcc: 1, a: 4, b: 4 },
    outputs: { y: 4 },
    kicad: {
      symbol: `74xx:74LS${id}`,
      footprint,
      pins: {
        1: 'a1', 2: 'b1', 3: 'y1',
        4: 'a2', 5: 'b2', 6: 'y2', 7: 'gnd',
        8: 'y3', 9: 'a3', 10: 'b3',
        11: 'y4', 12: 'a4', 13: 'b4', 14: 'vcc',
      },
    },
    connect(inp, out) {
      out.y = [
        gate(inp.a[0], inp.b[0]),
        gate(inp.a[1], inp.b[1]),
        gate(inp.a[2], inp.b[2]),
        gate(inp.a[3], inp.b[3]),
      ];
    },
  })();
};

/**
 * quad 2-input NAND gates
 * https://www.ti.com/lit/ds/symlink/sn74ls00.pdf
 */
export const u74x00 = create74xQuadLogicalGatesModule('00', logicalNand);
export const quad2InputNandGates74x00 = u74x00;

/**
 * quad 2-input NOR gates
 * https://www.ti.com/lit/ds/symlink/sn74ls02.pdf
 */
export const u74x02 = create74xQuadLogicalGatesModule('02', logicalOr);
export const quad2InputNorGates74x02 = u74x02;

/**
 * quad 2-input AND gates
 * https://www.ti.com/lit/ds/symlink/sn74ls08.pdf
 */
export const u74x08 = create74xQuadLogicalGatesModule('08', logicalAnd);
export const quad2InputAndGates74x08 = u74x08;

/**
 * quad 2-input OR gates
 * https://www.ti.com/lit/ds/symlink/sn74ls32.pdf
 */
export const u74x32 = create74xQuadLogicalGatesModule('32', logicalOr);
export const quad2InputOrGates74x32 = u74x32;

/**
 * quad 2-input XOR gates
 * https://www.ti.com/lit/ds/symlink/sn74ls86a.pdf
 */
export const u74x86 = create74xQuadLogicalGatesModule('86', logicalXor);
export const quad2InputXorGates74x86 = u74x86;

/**
 * quad 2-input XNOR gates
 * https://archive.org/details/bitsavers_tidataBookogicDataBook_23574286/page/n461/mode/2up
 */
export const u74x7266 = create74xQuadLogicalGatesModule('7266', logicalXnor);
export const quad2InputXnorGates74x7266 = u74x7266;

export const u74x04 = (footprint = defaultFootprint(14)) => createModule({
  name: '74x04',
  inputs: { gnd: 1, vcc: 1, a: 6 },
  outputs: { y: 6 },
  kicad: {
    symbol: '74xx:74LS04',
    footprint,
    pins: {
      1: 'a1', 2: 'y1', 3: 'a2',
      4: 'y2', 5: 'a3', 6: 'y3', 7: 'gnd',
      8: 'y4', 9: 'a4', 10: 'y5',
      11: 'a5', 12: 'y6', 13: 'a6', 14: 'vcc',
    },
  },
  connect(inp, out) {
    out.y = [
      logicalNot(inp.a[0]),
      logicalNot(inp.a[1]),
      logicalNot(inp.a[2]),
      logicalNot(inp.a[3]),
      logicalNot(inp.a[4]),
      logicalNot(inp.a[5]),
    ];
  },
})();

export const hexInverters74x04 = u74x04;

export const isolateGates = (
  gates: Module<{ a: 4, b: 4, gnd: 1, vcc: 1 }, { y: 4 }>,
  power: { vcc: Connection, gnd: Connection } = { vcc: 1, gnd: 1 }
) => {
  gates.in.gnd = power.gnd;
  gates.in.vcc = power.vcc;

  const asFunc = (index: number) => {
    let alreadyCalled = false;

    return (a: Connection, b: Connection) => {
      if (alreadyCalled) {
        throw new Error(`Isolated 74xx gate called multiple times`);
      }

      alreadyCalled = true;

      gates.in.a[index] = a;
      gates.in.b[index] = b;

      return gates.out.y[index];
    };
  };

  return [
    asFunc(0),
    asFunc(1),
    asFunc(2),
    asFunc(3),
  ] as const;
};

/**
 * 4-bit binary full adder with fast carry
 * https://www.ti.com/lit/ds/symlink/sn74ls283.pdf
 */
export const u74x283 = (footprint = defaultFootprint(16)) => createModule({
  name: '74x283',
  inputs: { gnd: 1, vcc: 1, a: 4, b: 4, c0: 1 },
  outputs: { s: 4, c4: 1 },
  kicad: {
    symbol: '74xx:74LS283',
    footprint,
  },
  connect(inp, out) {
    const s = adder(4);
    s.in.a = inp.a;
    s.in.b = inp.b;
    s.in.carryIn = inp.c0;

    out.s = s.out.sum;
    out.c4 = s.out.carryOut;
  },
})();

// 4-bit binary full adder with fast carry
export const binaryAdder74x283 = u74x283;