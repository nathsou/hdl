import { Circuit } from "./core";
export declare const createTransitors: (circ: Circuit) => {
    npn: () => import("./core").Module<{
        base: 1;
        collector: 1;
    }, {
        emitter: 1;
    }>;
};
