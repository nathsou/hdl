import { createArith } from "./arith";
import { createGates } from "./gates";
import { createTransitors } from "./transitors";
export const createBasicModules = (circ) => {
    const transitors = createTransitors(circ);
    const gates = createGates(circ);
    const arith = createArith(circ, gates);
    return {
        transitors,
        gates,
        arith,
    };
};
