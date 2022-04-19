import { createArith } from "./arith";
import { Circuit } from "../core";
import { createGates } from "./gates";
import { createMemoryModules } from "./mem";
import { createTransitors } from "./transitors";
import { extend4, extend8 } from './meta';

export const createBasicModules = (circ: Circuit) => {
  const transitors = createTransitors(circ);
  const gates = createGates(circ);
  const arith = createArith(circ, gates);
  const mem = createMemoryModules(circ, gates);
  const meta = {
    extend4,
    extend8
  };

  return {
    transitors,
    gates,
    arith,
    mem,
    meta,
  };
};