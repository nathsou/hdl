import { createModule, IO, metadata } from '../src';
import { KiCad } from '../src/export/kicad/kicad';
import { SExpr } from '../src/export/kicad/s-expr';
import { SN74LS00 } from '../src/modules/74xx/7400';

const KICAD_DIR = '/mnt/c/Program Files/KiCad/6.0/share/kicad';

const top = createModule({
  name: 'lab',
  inputs: {},
  outputs: {},
  connect() {
    const u1 = SN74LS00();
    const u2 = SN74LS00();

    IO.forward({ gnd: 0, vcc: 1 }, [u1, u2]);

    u1.in['1A'] = 0;
    u1.in['1B'] = 0;
    u1.in['2A'] = 0;
    u1.in['2B'] = 1;
    u1.in['3A'] = 1;
    u1.in['3B'] = 0;
    u1.in['4A'] = 1;
    u1.in['4B'] = 1;

    // invert
    u2.in['1A'] = u2.out['1Y'];
    u2.in['1B'] = u2.out['1Y'];
    u2.in['2A'] = u2.out['2Y'];
    u2.in['2B'] = u2.out['2Y'];
    u2.in['3A'] = u2.out['3Y'];
    u2.in['3B'] = u2.out['3Y'];
    u2.in['4A'] = u2.out['4Y'];
    u2.in['4B'] = u2.out['4Y'];
  }
})();

const main = async () => {
  const { circuit } = metadata(top);
  const libs = await KiCad.scanLibraries(KICAD_DIR);
  const symbols = await KiCad.collectUsedSymbols(top, libs);
  const netlist = KiCad.generateNetlist(symbols, circuit);
  console.log(SExpr.show(netlist));
};

main();