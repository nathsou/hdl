import { createArith } from "./arith";
import { Circuit } from "../core";
import { createGates } from "./gates";
import { createMemoryModules } from "./mem";
import { createTransitors } from "./transitors";
import { extendN } from './meta';

export const createBasicModules = (circ: Circuit) => {
  const transitors = createTransitors(circ);
  const gates = createGates(circ);
  const arith = createArith(circ, gates);
  const mem = createMemoryModules(circ, gates);
  const meta = {
    extendN: extendN(circ),
  };

  return {
    transitors,
    gates,
    arith,
    mem,
    meta,
  };
};