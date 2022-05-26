import ELK from 'elkjs';
import { writeFile } from 'fs/promises';
import { defineModule, defineSimulatedModule, KiCad, led, metadata, resistor, Rewire, SExpr, Tuple } from '../src';
import { Elk } from '../src/export/elk/elk';
import { nodeFileSystem } from '../src/export/fs/nodeFileSystem';
import { binaryAdder74x283 } from '../src/modules/74xx';
import { pinHeaders1x2 } from '../src/modules/connectors';

const KICAD_LIBS_DIR = '/mnt/c/Program Files/KiCad/6.0/share/kicad';

const dipSwitch8 = defineSimulatedModule({
  name: 'dip_sw_8',
  inputs: { d: 8 },
  outputs: { q: 8 },
  kicad: {
    symbol: 'Switch:SW_DIP_x08',
    footprint: 'Button_Switch_THT:SW_DIP_SPSTx08_Slide_9.78x22.5mm_W7.62mm_P2.54mm',
    pins: {
      1: 'd1', 2: 'd2', 3: 'd3', 4: 'd4', 5: 'd5', 6: 'd6', 7: 'd7', 8: 'd8',
      9: 'q1', 10: 'q2', 11: 'q3', 12: 'q4', 13: 'q5', 14: 'q6', 15: 'q7', 16: 'q8',
    },
  },
  simulate() { }
});

const top = defineModule({
  name: 'top',
  inputs: {},
  outputs: {},
  connect() {
    const power = pinHeaders1x2();
    const a = dipSwitch8();
    const b = dipSwitch8();
    const leds = Tuple.gen(9, i => led({ value: `red_${i}` }));
    const resistors = Tuple.gen(9, () => resistor({ value: '1k' }));
    const adderLo = binaryAdder74x283();
    const adderHi = binaryAdder74x283();

    const [vcc, gnd] = power.out.pins;

    a.in.d = Tuple.repeat(8, vcc);
    b.in.d = Tuple.repeat(8, vcc);

    adderLo.in.gnd = gnd;
    adderLo.in.vcc = vcc;

    adderLo.in.c0 = gnd;
    adderLo.in.a = Tuple.low(4, a.out.q);
    adderLo.in.b = Tuple.low(4, b.out.q);

    adderHi.in.c0 = adderLo.out.c4;
    adderHi.in.a = Tuple.high(4, a.out.q);
    adderHi.in.b = Tuple.high(4, b.out.q);

    const output = [adderHi.out.c4, ...adderHi.out.s, ...adderLo.out.s];

    Tuple.forEach(leds, (led, index) => {
      led.in['1'] = output[output.length - index - 1];
      resistors[index].in.lhs = led.out['2'];
      resistors[index].out.rhs = gnd;
    });
  }
})();

const main = async () => {
  const { circuit } = metadata(top);
  const svg = await Elk.renderSvg(new ELK(), Rewire.keepKiCadModules(circuit));
  const netlist = await KiCad.generateNetlist(top, KICAD_LIBS_DIR, nodeFileSystem);
  await writeFile('./out/jlcpcb.svg', svg);
  await writeFile('./out/jlcpcb.net', SExpr.show(netlist, false));
};

main();