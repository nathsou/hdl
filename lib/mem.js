import { createModule, width } from "./core";
export const createMemoryModules = (circ, gates) => {
    const srLatch = createModule({
        name: 'sr_latch',
        inputs: { s: width[1], r: width[1] },
        outputs: { q: width[1], qbar: width[1] },
        connect(inp, out) {
            const topNand = gates.nand();
            const botNand = gates.nand();
            topNand.in.a = inp.s;
            topNand.in.b = botNand.out.q;
            botNand.in.a = topNand.out.q;
            botNand.in.b = inp.r;
            out.q = topNand.out.q;
            out.qbar = botNand.out.q;
        },
    }, circ);
    return {
        srLatch,
    };
};
