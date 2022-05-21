import { defineSimulatedModule, Num } from "../core";
import { Range } from "../utils";

const createPinHeaders = <N extends Num>(cols: N) => {
  const nPadded = cols.toString().padStart(2, '0');
  return defineSimulatedModule({
    name: `std.pin_header_1x${cols}`,
    inputs: {},
    outputs: { pins: cols },
    kicad: {
      symbol: `Connector_Generic:Conn_01x${nPadded}`,
      footprint: `Connector_PinHeader_2.54mm:PinHeader_1x${nPadded}_P2.54mm_Vertical`,
      pins: Object.fromEntries(Range.map(1, (cols + 1) as Num, n => [n, `pins${n}`])),
    },
    simulate() {}
  });
};

export const pinHeaders1x1 = createPinHeaders(1);
export const pinHeaders1x2 = createPinHeaders(2);
export const pinHeaders1x3 = createPinHeaders(3);
export const pinHeaders1x4 = createPinHeaders(4);
export const pinHeaders1x5 = createPinHeaders(5);
export const pinHeaders1x6 = createPinHeaders(6);
export const pinHeaders1x7 = createPinHeaders(7);
export const pinHeaders1x8 = createPinHeaders(8);
export const pinHeaders1x9 = createPinHeaders(9);
export const pinHeaders1x10 = createPinHeaders(10);