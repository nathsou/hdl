import { createSimulatedModule } from "../core";

type ResistorOptions = {
  value: number | `${number}k`, // ohms
  footprint?: string,
};

export const resistor = (options: ResistorOptions) => createSimulatedModule({
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