import { createArith } from "./arith";
import { Circuit } from "./core";
import { createGates } from "./gates";
import { createTransitors } from "./transitors";

export const createBasicModules = (circ: Circuit) => {
  const transitors = createTransitors(circ);
  const gates = createGates(circ);
  const arith = createArith(circ, gates);

  return {
    transitors,
    gates,
    arith,
  };
};