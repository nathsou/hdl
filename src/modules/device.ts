import { defineSimulatedModule } from "../core";

type ResistorOptions = {
  value: number | `${number}k`, // ohms
  footprint?: string,
};

export const resistor = (options: ResistorOptions) => defineSimulatedModule({
  name: `R${options.value}`,
  inputs: { lhs: 1 },
  outputs: { rhs: 1 },
  kicad: {
    symbol: 'Device:R',
    footprint: options.footprint ?? 'Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal',
    pins: { 1: 'lhs', 2: 'rhs' },
  },
  simulate(inp, out) {
    out.rhs = inp.lhs;
  },
})();

type LedOptions = {
  value: string,
  footprint?: string,
};

export const led = (options: LedOptions) => defineSimulatedModule({
  name: `LED_${options.value}`,
  inputs: { lhs: 1 },
  outputs: { rhs: 1 },
  kicad: {
    symbol: 'Device:LED',
    footprint: options.footprint ?? 'LED_THT:LED_D5.0mm',
    pins: { 1: 'lhs', 2: 'rhs' },
  },
  simulate(inp, out) {
    out.rhs = inp.lhs;
  },
})();