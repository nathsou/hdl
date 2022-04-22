import { Circuit, createModule, Module, Multi } from "../core";
import { gen, genConnections } from "../utils";

export type MetaModules = ReturnType<typeof createMetaModules>;

export const createMetaModules = (circuit: Circuit) => {
  const extendN = <
    N extends Multi,
    InputPin extends string,
    OutputPin extends string,
    In extends Record<InputPin, 1>,
    Out extends Record<OutputPin, 1>,
    Comp extends Module<In, Out>,
  >(N: N, baseComp: () => Comp, inputPins: InputPin[], outputPins: OutputPin[], name: string) => {
    return createModule({
      name,
      inputs: inputPins.reduce((acc, pin) => {
        acc[pin] = N;
        return acc;
      }, {} as Record<InputPin, N>),
      outputs: outputPins.reduce((acc, pin) => {
        acc[pin] = N;
        return acc;
      }, {} as Record<OutputPin, N>),
      connect(inp, out) {
        const comps = gen(N, baseComp);

        for (const inputPin of inputPins) {
          for (let i = 0; i < N; i++) {
            /// @ts-ignore - TypeScript issue?
            comps[i].in[inputPin] = inp[inputPin][N - 1 - i];
          }
        }

        for (const outputPin of outputPins) {
          out[outputPin] = genConnections(N, i => comps[N - 1 - i].out[outputPin]);
        }
      },
    }, circuit);
  };

  return { extendN };
};