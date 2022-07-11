import { defineModule, Nat, Num } from "../core";
import { Range } from "../utils";

const definePinHeaders = <N extends Nat>(cols: N) => {
  const nPadded = cols.toString().padStart(2, '0');
  return (orientation: 'Vertical' | 'Horizontal' = 'Vertical') => defineModule({
    name: `pin_header_1x${cols}`,
    inputs: {},
    outputs: { pins: cols },
    kicad: {
      symbol: `Connector_Generic:Conn_01x${nPadded}`,
      footprint: `Connector_PinHeader_2.54mm:PinHeader_1x${nPadded}_P2.54mm_${orientation}`,
      pins: Object.fromEntries(Range.map(1, (cols + 1) as Num, n => [n, `pins${n}`])),
    },
    simulate() { }
  })();
};

export const PinHeaders1x1 = definePinHeaders(1);
export const PinHeaders1x2 = definePinHeaders(2);
export const PinHeaders1x3 = definePinHeaders(3);
export const PinHeaders1x4 = definePinHeaders(4);
export const PinHeaders1x5 = definePinHeaders(5);
export const PinHeaders1x6 = definePinHeaders(6);
export const PinHeaders1x7 = definePinHeaders(7);
export const PinHeaders1x8 = definePinHeaders(8);
export const PinHeaders1x9 = definePinHeaders(9);
export const PinHeaders1x10 = definePinHeaders(10);
export const PinHeaders1x11 = definePinHeaders(11);
export const PinHeaders1x12 = definePinHeaders(12);
export const PinHeaders1x13 = definePinHeaders(13);
export const PinHeaders1x14 = definePinHeaders(14);
export const PinHeaders1x15 = definePinHeaders(15);
export const PinHeaders1x16 = definePinHeaders(16);
export const PinHeaders1x17 = definePinHeaders(17);
export const PinHeaders1x18 = definePinHeaders(18);
export const PinHeaders1x19 = definePinHeaders(19);
export const PinHeaders1x20 = definePinHeaders(20);
export const PinHeaders1x21 = definePinHeaders(21);
export const PinHeaders1x22 = definePinHeaders(22);
export const PinHeaders1x23 = definePinHeaders(23);
export const PinHeaders1x24 = definePinHeaders(24);
export const PinHeaders1x25 = definePinHeaders(25);
export const PinHeaders1x26 = definePinHeaders(26);
export const PinHeaders1x27 = definePinHeaders(27);
export const PinHeaders1x28 = definePinHeaders(28);
export const PinHeaders1x29 = definePinHeaders(29);
export const PinHeaders1x30 = definePinHeaders(30);
export const PinHeaders1x31 = definePinHeaders(31);
export const PinHeaders1x32 = definePinHeaders(32);
export const PinHeaders1x33 = definePinHeaders(33);
export const PinHeaders1x34 = definePinHeaders(34);
export const PinHeaders1x35 = definePinHeaders(35);
export const PinHeaders1x36 = definePinHeaders(36);
export const PinHeaders1x37 = definePinHeaders(37);
export const PinHeaders1x38 = definePinHeaders(38);
export const PinHeaders1x39 = definePinHeaders(39);
export const PinHeaders1x40 = definePinHeaders(40);