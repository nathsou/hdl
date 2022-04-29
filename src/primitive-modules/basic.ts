import { createArith } from "./arith";
import { Circuit } from "../core";
import { createGates } from "./gates";
import { createMemoryModules } from "./mem";
import { createTransitors } from "./transitors";
import { createMetaModules } from './meta';
import { createRegisters } from "./regs";
import { createMultiplexers } from "./mux";

export const createBasicModules = (circ: Circuit) => {
  const meta = createMetaModules(circ);
  const transitors = createTransitors(circ);
  const gates = createGates(circ, meta);
  const mux = createMultiplexers(circ, gates);
  const arith = createArith(circ, gates);
  const mem = createMemoryModules(circ, gates);
  const regs = createRegisters(circ, gates, mem, arith);

  return {
    transitors,
    gates,
    mux,
    arith,
    mem,
    regs,
    meta,
  };
};