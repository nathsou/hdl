import { Circuit } from "./core";
import { Gates } from "./gates";
export declare const createMemoryModules: (circ: Circuit, gates: Gates) => {
    srLatch: () => import("./core").Module<{
        s: 1;
        r: 1;
    }, {
        q: 1;
        qbar: 1;
    }>;
};
