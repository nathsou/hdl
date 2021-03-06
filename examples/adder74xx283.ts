import { writeFile } from 'fs/promises';
import { defineModule, IO, KiCad, LED, Resistor, SExpr, Tuple } from '../src';
import { createGitLabKiCadLibReader } from '../src/export/kicad/gitlabLibReader';
import { BinaryAdder74x283 } from '../src/modules/74xx';
import { DipSwitch8 } from '../src/modules/switch';

const Top = defineModule({
  name: 'top',
  inputs: {},
  outputs: {},
  connect() {
    const a = DipSwitch8();
    const b = DipSwitch8();
    const leds = Tuple.gen(9, i => LED({ value: `red_${i}` }));
    const resistors = Tuple.gen(9, () => Resistor({ value: '1k' }));
    const adderLo = BinaryAdder74x283();
    const adderHi = BinaryAdder74x283();

    a.in.d = Tuple.repeat(8, 0);
    b.in.d = Tuple.repeat(8, 0);

    IO.forward({ vcc: 1, gnd: 0 }, [adderLo, adderHi]);

    adderLo.in.c0 = 0;
    adderLo.in.a = Tuple.low(4, a.out.q);
    adderLo.in.b = Tuple.low(4, b.out.q);

    adderHi.in.c0 = adderLo.out.c4;
    adderHi.in.a = Tuple.high(4, a.out.q);
    adderHi.in.b = Tuple.high(4, b.out.q);

    const output = [adderHi.out.c4, ...adderHi.out.s, ...adderLo.out.s];

    Tuple.forEach(leds, (led, index) => {
      led.in.lhs = output[output.length - index - 1];
      resistors[index].in.lhs = led.out.rhs;
      resistors[index].out.rhs = 0;
    });
  }
})();

const main = async () => {
  const netlist = await KiCad.generateNetlist({
    topModule: Top,
    libReader: createGitLabKiCadLibReader({ logRequests: true }),
    power: {
      symbol: 'Connector_Generic:Conn_01x02',
      footprint: 'Connector_PinHeader_2.54mm:PinHeader_1x02_P2.54mm_Vertical',
      pins: { 1: 'gnd', 2: 'vcc' },
    },
  });

  await writeFile('./out/adder74xx283.net', SExpr.show(netlist, false));
};

main();