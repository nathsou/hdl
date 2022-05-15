import { createModule, IO } from '../src';
import { KiCad } from '../src/export/kicad/kicad';
import { SExpr } from '../src/export/kicad/s-expr';
import { quad2InputNandGates7400 } from '../src/modules/74xx';
import { resistor } from '../src/modules/passive';

const KICAD_LIBS_DIR = '/mnt/c/Program Files/KiCad/6.0/share/kicad';

const top = createModule({
  name: 'lab',
  inputs: {},
  outputs: {},
  connect() {
    const u1 = quad2InputNandGates7400();
    const u2 = quad2InputNandGates7400();

    IO.forward({ gnd: 0, vcc: 1 }, [u1, u2]);

    const r1 = resistor({ value: '1k' });
    const r2 = resistor({ value: '1k' });
    const r3 = resistor({ value: '1k' });
    const r4 = resistor({ value: '1k' });

    r1.in.lhs = u1.out.y[0];
    r2.in.lhs = u1.out.y[1];
    r3.in.lhs = u1.out.y[2];
    r4.in.lhs = u1.out.y[3];

    u1.in.a = [0, 0, 1, 1];
    u1.in.b = [0, 1, 0, 1];

    const y: IO<4> = [r1.out.rhs, r2.out.rhs, r3.out.rhs, r4.out.rhs];

    // invert
    u2.in.a = y;
    u2.in.b = y;
  }
})();

const main = async () => {
  const libs = await KiCad.scanLibraries(KICAD_LIBS_DIR);
  const symbols = await KiCad.collectUsedSymbols(top, libs);
  const netlist = KiCad.generateNetlist(symbols, top);

  console.log(SExpr.show(netlist, false));
};

main();