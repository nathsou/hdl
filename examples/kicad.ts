import { createModule, IO } from '../src';
import { KiCad } from '../src/export/kicad/kicad';
import { SExpr } from '../src/export/kicad/s-expr';
import { binaryAdder74283 } from '../src/modules/74xx';

const KICAD_LIBS_DIR = '/Applications/KiCad/KiCad.app/Contents/SharedSupport';

const top = createModule({
  name: 'lab',
  inputs: {},
  outputs: {},
  connect() {
    const uAdder = binaryAdder74283();

    IO.forward({ gnd: 0, vcc: 1 }, [uAdder]);

    uAdder.in.a = [0, 1, 0, 1];
    uAdder.in.b = [1, 0, 1, 1];
  }
})();

const main = async () => {
  const libs = await KiCad.scanLibraries(KICAD_LIBS_DIR);
  const symbols = await KiCad.collectUsedSymbols(top, libs);
  const netlist = KiCad.generateNetlist(symbols, top);
  console.log(SExpr.show(netlist, false));

  // console.log(symbols.map(s => [s.symbol, s.pins]));
};

main();