import { Circuit } from "./core";
import { Gates } from "./gates";
export declare const createArith: (circ: Circuit, gates: Gates) => {
    halfAdder: () => import("./core").Module<{
        a: 1;
        b: 1;
    }, {
        sum: 1;
        carry: 1;
    }>;
    fullAdder: () => import("./core").Module<{
        a: 1;
        b: 1;
        carry_in: 1;
    }, {
        sum: 1;
        carry_out: 1;
    }>;
    adder4: () => import("./core").Module<{
        a: 4;
        b: 4;
        carry_in: 1;
    }, {
        sum: 4;
        carry_out: 1;
    }>;
    adder8: () => import("./core").Module<{
        a: 8;
        b: 8;
        carry_in: 1;
    }, {
        sum: 8;
        carry_out: 1;
    }>;
    adderSubtractor8: () => import("./core").Module<{
        a: 8;
        b: 8;
        subtract: 1;
    }, {
        sum: 8;
        carry_out: 1;
    }>;
};
