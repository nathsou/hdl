import { Circuit, CircuitState, PinId, State } from "./core";
export declare const deref: (state: CircuitState, pin: PinId) => State;
export declare const removeCompoundModules: (circ: Circuit) => Circuit;
export declare const createSim: (circ: Circuit) => {
    state: CircuitState;
    step: () => void;
};
