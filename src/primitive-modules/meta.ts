import { Circuit, createModule, Module, width } from "../core";
import { gen, genConnections } from "../utils";

export type Multi = Exclude<keyof typeof width, 0 | 1>;

export const extendN = (circuit: Circuit) => <
  N extends Multi,
  InputPin extends string,
  OutputPin extends string,
  Comp extends Module<{ [K in InputPin]: 1 }, { [K in OutputPin]: 1 }>
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
          /// @ts-ignore
          comps[i].in[inputPin] = inp[inputPin][N - 1 - i];
        }
      }

      for (const outputPin of outputPins) {
        out[outputPin] = genConnections(N, i => comps[N - 1 - i].out[outputPin]);
      }
    },
  }, circuit);
};
