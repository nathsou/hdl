import { createModule, high4, low4, rep8, width } from "./core";
export const createArith = (circ, gates) => {
    // a  b  c  s
    // 0  0  0  0
    // 0  1  0  1
    // 1  0  0  1
    // 1  1  1  0
    const halfAdder = createModule({
        name: 'half_adder',
        inputs: { a: width[1], b: width[1] },
        outputs: { sum: width[1], carry: width[1] },
        connect(inp, out) {
            const and1 = gates.and();
            const xor1 = gates.xor();
            and1.in.a = inp.a;
            and1.in.b = inp.b;
            xor1.in.a = inp.a;
            xor1.in.b = inp.b;
            out.sum = xor1.out.q;
            out.carry = and1.out.q;
        },
    }, circ);
    // ci a  b  co s
    // 0  0  0  0  0
    // 0  0  1  0  1
    // 0  1  0  0  1
    // 0  1  1  1  0
    // 1  0  0  0  1
    // 1  0  1  1  0
    // 1  1  0  1  0
    // 1  1  1  1  1
    const fullAdder = createModule({
        name: 'full_adder',
        inputs: { a: width[1], b: width[1], carry_in: width[1] },
        outputs: { sum: width[1], carry_out: width[1] },
        connect(inp, out) {
            const xor1 = gates.xor();
            const xor2 = gates.xor();
            const and1 = gates.and();
            const and2 = gates.and();
            const or1 = gates.or();
            // sum
            xor1.in.a = inp.a;
            xor1.in.b = inp.b;
            xor2.in.a = xor1.out.q;
            xor2.in.b = inp.carry_in;
            out.sum = xor2.out.q;
            // carry
            and1.in.a = inp.carry_in;
            and1.in.b = xor1.out.q;
            and2.in.a = inp.a;
            and2.in.b = inp.b;
            or1.in.a = and1.out.q;
            or1.in.b = and2.out.q;
            out.carry_out = or1.out.q;
        },
    }, circ);
    const adder4 = createModule({
        name: 'adder4',
        inputs: { a: width[4], b: width[4], carry_in: width[1] },
        outputs: { sum: width[4], carry_out: width[1] },
        connect(inp, out) {
            const adder0 = fullAdder();
            const adder1 = fullAdder();
            const adder2 = fullAdder();
            const adder3 = fullAdder();
            adder0.in.carry_in = inp.carry_in;
            adder0.in.a = inp.a[3];
            adder0.in.b = inp.b[3];
            adder1.in.carry_in = adder0.out.carry_out;
            adder1.in.a = inp.a[2];
            adder1.in.b = inp.b[2];
            adder2.in.carry_in = adder1.out.carry_out;
            adder2.in.a = inp.a[1];
            adder2.in.b = inp.b[1];
            adder3.in.carry_in = adder2.out.carry_out;
            adder3.in.a = inp.a[0];
            adder3.in.b = inp.b[0];
            out.sum = [
                adder3.out.sum,
                adder2.out.sum,
                adder1.out.sum,
                adder0.out.sum,
            ];
            out.carry_out = adder3.out.carry_out;
        },
    }, circ);
    const adder8 = createModule({
        name: 'adder8',
        inputs: { a: width[8], b: width[8], carry_in: width[1] },
        outputs: { sum: width[8], carry_out: width[1] },
        connect(inp, out) {
            const low = adder4();
            const high = adder4();
            low.in.carry_in = inp.carry_in;
            low.in.a = low4(inp.a);
            low.in.b = low4(inp.b);
            high.in.carry_in = low.out.carry_out;
            high.in.a = high4(inp.a);
            high.in.b = high4(inp.b);
            out.sum = [...high.out.sum, ...low.out.sum];
            out.carry_out = high.out.carry_out;
        },
    }, circ);
    const adderSubtractor8 = createModule({
        name: 'adder_subtractor8',
        inputs: { a: width[8], b: width[8], subtract: width[1] },
        outputs: { sum: width[8], carry_out: width[1] },
        connect(inp, out) {
            const adder = adder8();
            const xors = gates.xor8();
            xors.in.a = rep8(inp.subtract);
            xors.in.b = inp.b;
            adder.in.carry_in = inp.subtract;
            adder.in.a = inp.a;
            adder.in.b = xors.out.q;
            out.sum = adder.out.sum;
            out.carry_out = adder.out.carry_out;
        },
    }, circ);
    return {
        halfAdder,
        fullAdder,
        adder4,
        adder8,
        adderSubtractor8,
    };
};
