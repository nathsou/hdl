import ELK from 'elkjs';
import { writeFile } from 'fs/promises';
import { defineModule, KiCad, metadata, Rewire, SExpr, Tuple } from '../src';
import { Elk } from '../src/export/elk/elk';
import { nodeFileSystem } from '../src/export/fs/nodeFileSystem';
import { isolateGates, u74x08, u74x32, u74x86 } from '../src/modules/74xx';
import { pinHeaders1x8, pinHeaders1x9 } from '../src/modules/connectors';

const KICAD_LIBS_DIR = '/mnt/c/Program Files/KiCad/6.0/share/kicad';

const adder4 = defineModule({
  name: '74xx.full_adder4',
  inputs: { a: 4, b: 4, cin: 1 },
  outputs: { sum: 4, cout: 1 },
  connect({ a: [a3, a2, a1, a0], b: [b3, b2, b1, b0], cin: cin0 }, out) {
    const [xor1, xor2, xor3, xor4] = isolateGates(u74x86());
    const [xor5, xor6, xor7, xor8] = isolateGates(u74x86());
    const [and1, and2, and3, and4] = isolateGates(u74x08());
    const [and5, and6, and7, and8] = isolateGates(u74x08());
    const [or1, or2, or3, or4] = isolateGates(u74x32());

    const inter0 = xor1(a0, b0);
    const s0 = xor2(inter0, cin0);
    const cin1 = or1(and1(inter0, cin0), and2(a0, b0));

    const inter1 = xor3(a1, b1);
    const s1 = xor4(inter1, cin1);
    const cin2 = or2(and3(inter1, cin1), and4(a1, b1));

    const inter2 = xor5(a2, b2);
    const s2 = xor6(inter2, cin2);
    const cin3 = or3(and5(inter2, cin2), and6(a2, b2));

    const inter3 = xor7(a3, b3);
    const s3 = xor8(inter3, cin3);
    const cin4 = or4(and7(inter3, cin3), and8(a3, b3));

    out.sum = [s3, s2, s1, s0];
    out.cout = cin4;
  }
});

const adder8 = defineModule({
  name: '74xx.full_adder8',
  inputs: { a: 8, b: 8, cin: 1 },
  outputs: { cout: 1, sum: 8 },
  connect({ a, b, cin }, out) {
    const adderLo = adder4();
    const adderHi = adder4();

    adderLo.in.a = Tuple.low(4, a);
    adderLo.in.b = Tuple.low(4, b);
    adderLo.in.cin = cin;

    adderHi.in.cin = adderLo.out.cout;
    adderHi.in.a = Tuple.high(4, a);
    adderHi.in.b = Tuple.high(4, b);

    out.cout = adderHi.out.cout;
    out.sum = [...adderHi.out.sum, ...adderLo.out.sum];
  },
});

const top = defineModule({
  name: 'top',
  inputs: {},
  outputs: {},
  connect() {
    const a = pinHeaders1x8();
    const b = pinHeaders1x8();
    const outputPins = pinHeaders1x9();
    const uAdder = adder8();

    uAdder.in.cin = 0;
    uAdder.in.a = a.out.pins;
    uAdder.in.b = b.out.pins;

    outputPins.out.pins = [uAdder.out.cout, ...uAdder.out.sum];
  }
})();

const main = async () => {
  const { circuit } = metadata(top);
  const svg = await Elk.renderSvg(new ELK(), Rewire.keepKiCadModules(circuit));
  const netlist = await KiCad.generateNetlist({
    topModule: top,
    librariesLocation: KICAD_LIBS_DIR,
    fs: nodeFileSystem,
    power: {
      symbol: 'Connector_Generic:Conn_01x02',
      footprint: 'Connector_PinHeader_2.54mm:PinHeader_1x02_P2.54mm_Vertical',
      pins: { 1: 'gnd', 2: 'vcc' },
    },
  });

  await writeFile('./out/lab.svg', svg);
  await writeFile('./out/lab.net', SExpr.show(netlist, false));
};

main();