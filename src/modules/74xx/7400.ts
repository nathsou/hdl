import { createModule } from "../../core";
import { logicalNand } from "../gates";

/**
 * Four independent 2-input NAND gates
 * https://www.ti.com/lit/ds/symlink/sn74ls00.pdf
 */
export const SN74LS00 = createModule({
  name: '7400',
  inputs: {
    gnd: 1, vcc: 1,
    '1A': 1, '1B': 1,
    '2A': 1, '2B': 1,
    '3A': 1, '3B': 1,
    '4A': 1, '4B': 1,
  },
  outputs: { '1Y': 1, '2Y': 1, '3Y': 1, '4Y': 1 },
  kicad: {
    symbol: '74xx:74LS00',
    footprint: 'Package_DIP:DIP-14_W7.62mm_Socket',
    pins: {
      1: '1A', 2: '1B', 3: '1Y', 4: '2A', 5: '2B', 6: '2Y', 7: 'gnd',
      8: '3Y', 9: '3A', 10: '3B', 11: '4Y', 12: '4A', 13: '4B', 14: 'vcc',
    },
  },
  connect(inp, out) {
    out['1Y'] = logicalNand(inp['1A'], inp['1B']);
    out['2Y'] = logicalNand(inp['2A'], inp['2B']);
    out['3Y'] = logicalNand(inp['3A'], inp['3B']);
    out['4Y'] = logicalNand(inp['4A'], inp['4B']);
  },
});