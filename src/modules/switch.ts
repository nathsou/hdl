import { defineModule } from "../core";

export const DipSwitch8 = (
  footprint = 'Button_Switch_THT:SW_DIP_SPSTx08_Slide_9.78x22.5mm_W7.62mm_P2.54mm'
) => defineModule({
  name: 'dip_sw_8',
  inputs: { d: 8 },
  outputs: { q: 8 },
  kicad: {
    symbol: 'Switch:SW_DIP_x08',
    footprint,
    pins: {
      1: 'd1', 2: 'd2', 3: 'd3', 4: 'd4', 5: 'd5', 6: 'd6', 7: 'd7', 8: 'd8',
      9: 'q1', 10: 'q2', 11: 'q3', 12: 'q4', 13: 'q5', 14: 'q6', 15: 'q7', 16: 'q8',
    },
  },
  simulate() { }
})();