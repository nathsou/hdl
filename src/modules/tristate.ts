import { defineModule, IO, metadata, Module, Nat, Num } from "../core";
import { Tuple } from "../utils";

export const triStateBuffer1 = defineModule({
  name: 'tristate_buffer',
  inputs: { d: 1, enable: 1 },
  outputs: { q: 1 },
  simulate({ d, enable }, out) {
    out.q = enable === 1 ? d : 'x';
  }
});

export const triStateBuffer = <N extends Nat>(N: N) => defineModule({
  name: `tristate_buffer_${N}`,
  inputs: { d: N, enable: 1 },
  outputs: { q: N },
  connect({ d, enable }, out) {
    const N = IO.width(d) as N;
    const buffers = Tuple.gen(N, triStateBuffer1);

    IO.forward({ enable }, buffers);

    buffers.forEach((buffer, index) => {
      buffer.in.d = Array.isArray(d) ? d[index] : d;
    });

    out.q = IO.gen(N, n => buffers[n].out.q);
  }
})();

export const withTriStateOutput = <
  In extends Record<string, Nat>,
  Out extends Record<string, Nat>
>(mod: Module<In, Out>, triStateOutputs: (keyof Out)[]): Module<In & { outputEnable: 1 }, Out> => {
  const { circuit, id } = metadata(mod);
  const node = circuit.modules.get(id)!;
  const sig = circuit.signatures.get(node.name)!;

  return defineModule({
    name: `${node.name}_tristate_output`,
    inputs: { ...sig.inputs as In, outputEnable: 1 },
    outputs: sig.outputs as Out,
    connect(inp, out) {
      Object.keys(sig.inputs).forEach(input => {
        /// @ts-ignore
        mod.in[input] = inp[input];
      });

      Object.entries(sig.outputs).forEach(([output, width]) => {
        if (triStateOutputs.includes(output)) {
          const buffer = triStateBuffer(width);
          buffer.in.d = mod.out[output];
          buffer.in.enable = inp.outputEnable;
          /// @ts-ignore
          out[output] = buffer.out.q;
        } else {
          /// @ts-ignore
          out[output] = mod.out[output];
        }
      });
    }
  })();
};

export const withTriStateInput = <
  In extends Record<string, Nat>,
  Out extends Record<string, Nat>
>(mod: Module<In, Out>, triStateInputs: (keyof Out)[]): Module<In & { inputEnable: 1 }, Out> => {
  const { circuit, id } = metadata(mod);
  const node = circuit.modules.get(id)!;
  const sig = circuit.signatures.get(node.name)!;

  return defineModule({
    name: `${node.name}_tristate_input`,
    inputs: { ...sig.inputs as In, inputEnable: 1 },
    outputs: sig.outputs as Out,
    connect(inp, out) {
      Object.entries(sig.inputs).forEach(([input, width]) => {
        if (triStateInputs.includes(input)) {
          const buffer = triStateBuffer(width);
          buffer.in.d = mod.in[input];
          buffer.in.enable = inp.inputEnable;
          /// @ts-ignore
          mod.in[input] = buffer.out.q;
        } else {
          /// @ts-ignore
          mod.in[input] = inp[input];
        }
      });

      Object.keys(sig.outputs).forEach((output) => {
        /// @ts-ignore
        out[output] = mod.out[output];
      });
    }
  })();
};