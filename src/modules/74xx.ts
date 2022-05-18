import { createModule } from "../core";
import { logicalNand } from "./gates";
import { adder } from './arith';

/**
 * Four independent 2-input NAND gates
 * https://assets.nexperia.com/documents/data-sheet/74HC_HCT00.pdf
 */
export const u7400 = createModule({
  name: '7400',
  inputs: { gnd: 1, vcc: 1, a: 4, b: 4 },
  outputs: { y: 4 },
  kicad: {
    symbol: '74xx:74LS00',
    footprint: 'Package_DIP:DIP-14_W7.62mm_Socket',
    pins: {
      1: 'a1', 2: 'b1', 3: 'y1',
      4: 'a2', 5: 'b2', 6: 'y2', 7: 'gnd',
      8: 'y3', 9: 'a3', 10: 'b3',
      11: 'y4', 12: 'a4', 13: 'b4', 14: 'vcc',
    },
  },
  connect(inp, out) {
    out.y = [
      logicalNand(inp.a[0], inp.b[0]),
      logicalNand(inp.a[1], inp.b[1]),
      logicalNand(inp.a[2], inp.b[2]),
      logicalNand(inp.a[3], inp.b[3]),
    ];
  },
});

export const quad2InputNandGates7400 = u7400;

/**
 * 4-bit binary full adder with fast carry
 * https://www.ti.com/lit/ds/symlink/sn74ls283.pdf
 */
export const u74283 = createModule({
  name: '74283',
  inputs: { gnd: 1, vcc: 1, a: 4, b: 4, c0: 1 },
  outputs: { s: 4, c4: 1 },
  kicad: {
    symbol: '74xx:74LS283',
    footprint: 'Package_DIP:DIP-16_W7.62mm_Socket',
  },
  connect(inp, out) {
    const s = adder(4);
    s.in.a = inp.a;
    s.in.b = inp.b;
    s.in.carryIn = inp.c0;

    out.s = s.out.sum;
    out.c4 = s.out.carryOut;
  },
});

// 4-bit binary full adder with fast carry
export const binaryAdder74283 = u74283;