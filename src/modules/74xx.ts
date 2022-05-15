import { createModule } from "../core";
import { logicalNand } from "./gates";

/**
 * Four independent 2-input NAND gates
 * https://www.ti.com/lit/ds/symlink/sn74ls00.pdf
 */
export const SN74LS00 = createModule({
  name: '7400',
  inputs: { gnd: 1, vcc: 1, a: 4, b: 4 },
  outputs: { y: 4 },
  kicad: {
    symbol: '74xx:74LS00',
    footprint: 'Package_DIP:DIP-14_W7.62mm_Socket',
    pins: {
      1: 'a0', 2: 'b0', 3: 'y0',
      4: 'a1', 5: 'b1', 6: 'y1', 7: 'gnd',
      8: 'y2', 9: 'a2', 10: 'b2',
      11: 'y3', 12: 'a3', 13: 'b3', 14: 'vcc',
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

export const quad2InputNandGates7400 = SN74LS00;