import { Circuit } from "./core";
export declare type Gates = ReturnType<typeof createGates>;
export declare const createGates: (circuit: Circuit) => {
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
