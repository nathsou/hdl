import { createModule, createSimulator, IO, Tuple } from '../src';
import { KiCad } from '../src/export/kicad/kicad';
import { SExpr } from '../src/export/kicad/s-expr';
import { isolateGates, u74x02, u74x08, u74x32 } from '../src/modules/74xx';

const KICAD_LIBS_DIR = '/mnt/c/Program Files/KiCad/6.0/share/kicad';

const adder4 = createModule({
  name: '74xx_full_adder4',
  inputs: { a: 4, b: 4, cin: 1 },
  outputs: { s: 4, cout: 1 },
  connect({ a: [a3, a2, a1, a0], b: [b3, b2, b1, b0], cin: cin0 }, out) {
    const [nor1, nor2, nor3, nor4] = isolateGates(u74x02());
    const [nor5, nor6, nor7, nor8] = isolateGates(u74x02());
    const [and1, and2, and3, and4] = isolateGates(u74x08());
    const [and5, and6, and7, and8] = isolateGates(u74x08());
    const [or1, or2, or3, or4] = isolateGates(u74x32());

    const inter0 = nor1(a0, b0);
    const s0 = nor2(inter0, cin0);
    const cin1 = or1(and1(inter0, cin0), and2(a0, b0));

    const inter1 = nor3(a1, b1);
    const s1 = nor4(inter1, cin1);
    const cin2 = or2(and3(inter1, cin1), and4(a1, b1));

    const inter2 = nor5(a2, b2);
    const s2 = nor6(inter2, cin2);
    const cin3 = or3(and5(inter2, cin2), and6(a2, b2));

    const inter3 = nor7(a3, b3);
    const s3 = nor8(inter3, cin3);
    const cin4 = or4(and7(inter3, cin3), and8(a3, b3));

    out.s = [s3, s2, s1, s0];
    out.cout = cin4;
  }
});

const top = createModule({
  name: 'lab',
  inputs: { a: 4, b: 4 },
  outputs: { leds: 5 },
  connect({ a, b }, out) {
    const uAdder = adder4();

    uAdder.in.cin = 0;
    uAdder.in.a = a;
    uAdder.in.b = b;

    out.leds = [uAdder.out.cout, ...uAdder.out.s];
  }
})();

const main = async () => {
  // const libs = await KiCad.scanLibraries(KICAD_LIBS_DIR);
  // const symbols = await KiCad.collectUsedSymbols(top, libs);
  // const netlist = KiCad.generateNetlist(symbols, top);
  // console.log(SExpr.show(netlist, false));

  const sim = createSimulator(top);

  sim.input({ a: [0, 0, 0, 1], b: [0, 0, 0, 1] });

  console.log(sim.state.read(top.out.leds));
};

main();