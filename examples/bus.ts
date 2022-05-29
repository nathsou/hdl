import { createSimulator, defineModule, demux16, IO, Num, Range, Tuple } from "../src";

const triStateBuffer = defineModule({
  name: 'tristate_buffer',
  inputs: { d: 1, enable: 1 },
  outputs: { q: 1 },
  simulate({ d, enable }, out) {
    out.q = enable === 1 ? d : 'x';
  }
});

export const createBus = <N extends Num>(name: string, width: N) => {
  const busModule = defineModule({
    name,
    inputs: { d: width },
    outputs: { q: width },
    connect({ d }, out) {
      out.q = d;
    }
  })();

  return busModule;
};

const triStateBuffer8 = defineModule({
  name: 'tristate_buffer8',
  inputs: { d: 8, enable: 1 },
  outputs: { q: 8 },
  connect({ d, enable }, out) {
    const buffers = Tuple.gen(8, triStateBuffer);
    IO.forward({ enable }, buffers);

    Tuple.forEach(buffers, (buffer, index) => {
      buffer.in.d = d[index];
    });

    out.q = Tuple.gen(8, n => buffers[n].out.q);
  }
});

const top = defineModule({
  name: 'top',
  inputs: { sel: 4 },
  outputs: { leds: 8 },
  connect({ sel }, out) {
    const bus = createBus('data_bus', 8);
    const buffers = Tuple.gen(16, triStateBuffer8);

    buffers.forEach((buffer, index) => {
      buffer.in.d = Tuple.bin(index, 8);
    });

    const dem = demux16(1);

    dem.in.sel = sel;
    dem.in.d = 1;

    Range.iter(0, 16, n => {
      buffers[n].in.enable = dem.out[`q${n}`];
    });

    buffers.forEach(buffer => {
      bus.in.d = buffer.out.q;
    });

    out.leds = bus.out.q;
  }
})();

const main = () => {
  const sim = createSimulator(top, {
    approach: 'event-driven',
    checkConnections: true,
  });

  sim.input({ sel: Tuple.bin(11, 4) });

  const out = sim.state.read(top.out.leds).join('');
  console.log(parseInt(out, 2), out);
};

main();