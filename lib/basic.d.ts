import { Circuit } from "./core";
export declare const createBasicModules: (circ: Circuit) => {
    transitors: {
        npn: () => import("./core").Module<{
            base: 1;
            collector: 1;
        }, {
            emitter: 1;
        }>;
    };
    gates: {
        not: () => import("./core").Module<{
            d: 1;
        }, {
            q: 1;
        }>;
        and: () => import("./core").Module<{
            a: 1;
            b: 1;
        }, {
            q: 1;
        }>;
        or: () => import("./core").Module<{
            a: 1;
            b: 1;
        }, {
            q: 1;
        }>;
        xor: () => import("./core").Module<{
            a: 1;
            b: 1;
        }, {
            q: 1;
        }>;
        nand: () => import("./core").Module<{
            a: 1;
            b: 1;
        }, {
            q: 1;
        }>;
        not4: () => import("./core").Module<Record<"d", 4>, {
            q: 4;
        }>;
        not8: () => import("./core").Module<Record<"d", 8>, {
            q: 8;
        }>;
        and4: () => import("./core").Module<Record<"a" | "b", 4>, {
            q: 4;
        }>;
        and8: () => import("./core").Module<Record<"a" | "b", 8>, {
            q: 8;
        }>;
        xor4: () => import("./core").Module<Record<"a" | "b", 4>, {
            q: 4;
        }>;
        xor8: () => import("./core").Module<Record<"a" | "b", 8>, {
            q: 8;
        }>;
        logicalAnd3: () => import("./core").Module<{
            d: 3;
        }, {
            q: 1;
        }>;
    };
    arith: {
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
};
