import { createArith } from "./arith";
import { Circuit } from "./core";
import { createGates } from "./gates";
import { createMemoryModules } from "./mem";
import { createTransitors } from "./transitors";

export const createBasicModules = (circ: Circuit) => {
  const transitors = createTransitors(circ);
  const gates = createGates(circ);
  const arith = createArith(circ, gates);
  const mem = createMemoryModules(circ, gates);

  return {
    transitors,
    gates,
    arith,
    mem,
  };
};