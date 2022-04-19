import { Circuit, createModule, Module, width } from "../core";
import { high4, low4 } from "../utils";

export const extend4 = <
  InputPin extends string,
  OutputPin extends string,
  Comp extends Module<{ [K in InputPin]: 1 }, { [K in OutputPin]: 1 }>
>(baseComp: () => Comp, inputPins: InputPin[], outputPin: OutputPin, name: string, circuit: Circuit) => {
  return createModule({
    name,
    inputs: inputPins.reduce((acc, pin) => {
      acc[pin] = 4;
      return acc;
    }, {} as Record<InputPin, 4>),
    outputs: { [outputPin]: width[4] } as { [K in OutputPin]: 4 },
    connect(inp, out) {
      const c3 = baseComp();
      const c2 = baseComp();
      const c1 = baseComp();
      const c0 = baseComp();

      for (const inputPin of inputPins) {
        /// @ts-ignore
        c0.in[inputPin] = inp[inputPin][3];
        /// @ts-ignore
        c1.in[inputPin] = inp[inputPin][2];
        /// @ts-ignore
        c2.in[inputPin] = inp[inputPin][1];
        /// @ts-ignore
        c3.in[inputPin] = inp[inputPin][0];
      }

      // @ts-ignore
      out[outputPin] = [c3.out[outputPin], c2.out[outputPin], c1.out[outputPin], c0.out[outputPin]];
    },
  }, circuit);
};

export const extend8 = <
  InputPin extends string,
  OutputPin extends string,
  Comp extends Module<{ [K in InputPin]: 4 }, { [K in OutputPin]: 4 }>
>(baseComp: () => Comp, inputPins: InputPin[], outputPin: OutputPin, name: string, circuit: Circuit) => {
  return createModule({
    name,
    inputs: inputPins.reduce((acc, pin) => {
      acc[pin] = 8;
      return acc;
    }, {} as Record<InputPin, 8>),
    outputs: { [outputPin]: width[8] } as { [K in OutputPin]: 8 },
    connect(inp, out) {
      const hi = baseComp();
      const lo = baseComp();

      for (const inputPin of inputPins) {
        /// @ts-ignore
        hi.in[inputPin] = high4(inp[inputPin]);
        /// @ts-ignore
        lo.in[inputPin] = low4(inp[inputPin]);
      }

      // @ts-ignore
      out[outputPin] = [...hi.out[outputPin], ...lo.out[outputPin]];
    },
  }, circuit);
};