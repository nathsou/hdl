import { Connection, defineModule, Module } from "../core";
import { Adder } from './arith';
import { land, lnand, lnor, lnot, lor, lxnor, lxor } from "./gates";

// https://en.wikipedia.org/wiki/List_of_7400-series_integrated_circuits

const defaultFootprint = (n: number) => `Package_DIP:DIP-${n}_W7.62mm_Socket`;

const create74xQuadLogicalGatesModule = (id: string, gate: (a: Connection, b: Connection) => Connection) => {
  return (footprint = defaultFootprint(14)) => defineModule({
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
export const U74x00 = create74xQuadLogicalGatesModule('00', lnand);
export const Quad2InputNandGates74x00 = U74x00;

/**
 * quad 2-input NOR gates
 * https://www.ti.com/lit/ds/symlink/sn74ls02.pdf
 */
export const U74x02 = create74xQuadLogicalGatesModule('02', lnor);
export const Quad2InputNorGates74x02 = U74x02;

/**
 * quad 2-input AND gates
 * https://www.ti.com/lit/ds/symlink/sn74ls08.pdf
 */
export const U74x08 = create74xQuadLogicalGatesModule('08', land);
export const Quad2InputAndGates74x08 = U74x08;

/**
 * quad 2-input OR gates
 * https://www.ti.com/lit/ds/symlink/sn74ls32.pdf
 */
export const U74x32 = create74xQuadLogicalGatesModule('32', lor);
export const Quad2InputOrGates74x32 = U74x32;

/**
 * quad 2-input XOR gates
 * https://www.ti.com/lit/ds/symlink/sn74ls86a.pdf
 */
export const U74x86 = create74xQuadLogicalGatesModule('86', lxor);
export const Quad2InputXorGates74x86 = U74x86;

/**
 * quad 2-input XNOR gates
 * https://archive.org/details/bitsavers_tidataBookogicDataBook_23574286/page/n461/mode/2up
 */
export const U74x7266 = create74xQuadLogicalGatesModule('7266', lxnor);
export const Quad2InputXnorGates74x7266 = U74x7266;

export const U74x04 = (footprint = defaultFootprint(14)) => defineModule({
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
      lnot(inp.a[0]),
      lnot(inp.a[1]),
      lnot(inp.a[2]),
      lnot(inp.a[3]),
      lnot(inp.a[4]),
      lnot(inp.a[5]),
    ];
  },
})();

export const HexInverters74x04 = U74x04;

export const isolateGates = (
  gates: Module<{ a: 4, b: 4, gnd: 1, vcc: 1 }, { y: 4 }>,
  power: { vcc: Connection, gnd: Connection } = { vcc: 1, gnd: 0 }
) => {
  gates.in.gnd = power.gnd;
  gates.in.vcc = power.vcc;

  const isolateAtIndex = (index: number) => {
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
    isolateAtIndex(0),
    isolateAtIndex(1),
    isolateAtIndex(2),
    isolateAtIndex(3),
  ] as const;
};

/**
 * 4-bit binary full adder with fast carry
 * https://www.ti.com/lit/ds/symlink/sn74ls283.pdf
 */
export const U74x283 = (footprint = defaultFootprint(16)) => defineModule({
  name: '74x283',
  inputs: { gnd: 1, vcc: 1, a: 4, b: 4, c0: 1 },
  outputs: { s: 4, c4: 1 },
  kicad: {
    symbol: '74xx:74LS283',
    footprint,
  },
  connect(inp, out) {
    const sum = Adder(4);
    sum.in.a = inp.a;
    sum.in.b = inp.b;
    sum.in.carryIn = inp.c0;

    out.s = sum.out.sum;
    out.c4 = sum.out.carryOut;
  },
})();

// 4-bit binary full adder with fast carry
export const BinaryAdder74x283 = U74x283;