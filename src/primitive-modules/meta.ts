import { Circuit, IO, createModule, Module, Num } from "../core";
import { Tuple } from "../utils";

export type MetaModules = ReturnType<typeof createMetaModules>;

export const createMetaModules = (circuit: Circuit) => {
  const extendN = <
    N extends Num,
    InputPin extends string,
    OutputPin extends string,
    Comp extends Module<Record<InputPin, 1>, Record<OutputPin, 1>>,
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
        const comps = Tuple.gen(N, baseComp);

        for (const inputPin of inputPins) {
          for (let i = 0; i < N; i++) {
            /// @ts-ignore
            comps[i].in[inputPin] = N === 1 ? inp[inputPin] : inp[inputPin][N - 1 - i];
          }
        }

        for (const outputPin of outputPins) {
          out[outputPin] = IO.gen(N, i => comps[N - 1 - i].out[outputPin]);
        }
      },
    }, circuit);
  };

  return { extendN };
};