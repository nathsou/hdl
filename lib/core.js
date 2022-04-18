import { join } from "./utils";
let _nextId = 0;
const nextId = () => _nextId++;
export const isRawConnection = (x) => {
    return (typeof x === 'object' &&
        typeof x.componentId === 'number' &&
        typeof x.pin === 'string');
};
export const isNodeState = (x) => {
    if (typeof x !== 'object') {
        return false;
    }
    if (x.type !== 'const' && x.type !== 'ref') {
        return false;
    }
    if (x.type === 'const') {
        return x.value === 0 || x.value === 1;
    }
    return typeof x.ref === 'string';
};
export const createCircuit = () => {
    const circuit = {
        modules: new Map(),
        signatures: new Map(),
        nets: new Map(),
    };
    const _createPrimitiveModule = (def) => {
        return createPrimitiveModule(def, circuit);
    };
    const _createCompoundModule = (def) => {
        return createModule(def, circuit);
    };
    return {
        circuit,
        createPrimitiveModule: _createPrimitiveModule,
        createModule: _createCompoundModule,
    };
};
export const createPrimitiveModule = (def, circuit) => {
    return _createModule(Object.assign(Object.assign({}, def), { type: 'primitive' }), circuit);
};
export const createModule = (def, circuit) => {
    return _createModule(Object.assign(Object.assign({}, def), { type: 'compound' }), circuit);
};
const consts = (() => {
    let consts = null;
    return (circ) => {
        if (consts === null) {
            const constsMod = createPrimitiveModule({
                name: '<consts>',
                inputs: {},
                outputs: { vcc: width[1], gnd: width[1] },
                simulate(_, out) {
                    out.vcc = 1;
                    out.gnd = 0;
                }
            }, circ);
            consts = constsMod();
        }
        return consts;
    };
})();
const connectionHandler = (id, mod, circuit, isInput) => {
    const sig = mod[isInput ? 'inputs' : 'outputs'];
    const prefix = isInput ? 'in' : 'out';
    const connectionOf = (v) => v === 0 ? consts(circuit).out.gnd : v === 1 ? consts(circuit).out.vcc : v;
    return {
        get: (_, pin) => {
            if (typeof pin !== 'string') {
                throw new Error(`Pin name must be a string`);
            }
            const width = sig[pin];
            if (width === 1) {
                return { componentId: id, pin };
            }
            else {
                const out = [];
                for (let n = 0; n < width; n++) {
                    out.push({ componentId: id, pin: `${pin}${width - n - 1}` });
                }
                return out;
            }
        },
        set: (_, pin, value) => {
            if (typeof pin !== 'string') {
                throw new Error(`Pin name must be a string`);
            }
            const outputWidth = Array.isArray(value) ? value.length : 1;
            const expectedWidth = sig[pin];
            if (outputWidth !== expectedWidth) {
                throw new Error(`Incorrect pin width for ${mod.name}.${prefix}.${pin}, expected ${expectedWidth}, got ${outputWidth}`);
            }
            value = connectionOf(value);
            const connect = (modId, dir, pin, target) => {
                const net = `${pin}:${modId}`;
                const targetNet = `${target.pin}:${target.componentId}`;
                pushRecord(circuit.modules.get(modId).pins[dir], pin, target);
                if (!circuit.nets.has(net)) {
                    circuit.nets.set(net, { in: [], out: [], id: modId });
                }
                if (!circuit.nets.has(targetNet)) {
                    circuit.nets.set(targetNet, { in: [], out: [], id: target.componentId });
                }
                circuit.nets.get(net).in.push(targetNet);
                circuit.nets.get(targetNet).out.push(net);
            };
            if (isRawConnection(value)) {
                connect(id, isInput ? 'in' : 'out', pin, value);
                return true;
            }
            if (Array.isArray(value)) {
                value.forEach((v, n) => {
                    v = connectionOf(v);
                    if (isRawConnection(v)) {
                        const key = `${pin}${expectedWidth - n - 1}`;
                        connect(id, isInput ? 'in' : 'out', key, v);
                    }
                    else {
                        throw new Error(`Invalid connection for ${mod.name}.${prefix}.${pin}`);
                    }
                });
                return true;
            }
            throw new Error(`Invalid pin value for ${mod.name}.${prefix}.${pin}, got ${value}`);
        },
    };
};
const subModulesStack = [];
const _createModule = (mod, circuit) => {
    if (circuit.signatures.has(mod.name)) {
        throw new Error(`Module ${mod.name} already defined`);
    }
    const duplicatePin = Object.keys(mod.inputs).find(pin => mod.outputs[pin] !== undefined);
    if (duplicatePin != undefined) {
        throw new Error(`Duplicate pin '${duplicatePin}' in module '${mod.name}'`);
    }
    circuit.signatures.set(mod.name, {
        inputs: mod.inputs,
        outputs: mod.outputs,
    });
    return () => {
        var _a;
        const id = nextId();
        const pins = {
            in: Object.fromEntries(Object.keys(mod.inputs).map(pin => [pin, []])),
            out: Object.fromEntries(Object.keys(mod.outputs).map(pin => [pin, []])),
        };
        for (const pin of join(Object.keys(mod.inputs), Object.keys(mod.outputs))) {
            circuit.nets.set(`${pin}:${id}`, { in: [], out: [], id });
        }
        const node = {
            id,
            name: mod.name,
            pins,
            subModules: [],
        };
        circuit.modules.set(id, node);
        const inputs = new Proxy({}, connectionHandler(id, mod, circuit, true));
        const outputs = new Proxy({}, connectionHandler(id, mod, circuit, false));
        (_a = subModulesStack.at(-1)) === null || _a === void 0 ? void 0 : _a.push(node);
        // register connections
        if (mod.type === 'compound') {
            const subModules = [];
            subModulesStack.push(subModules);
            mod.connect(inputs, outputs);
            node.subModules = subModules;
            subModulesStack.pop();
            for (const [pin, width] of Object.entries(mod.outputs)) {
                if (width === 1) {
                    if (pins.out[pin] === undefined) {
                        throw new Error(`Unconnected output pin '${pin}' in module '${mod.name}'`);
                    }
                }
                else {
                    for (let n = 0; n < width; n++) {
                        const key = `${pin}${width - n - 1}`;
                        if (pins.out[key] === undefined) {
                            throw new Error(`Unconnected output pin '${key}' in module '${mod.name}'`);
                        }
                    }
                }
            }
        }
        if (mod.type === 'primitive') {
            const f = mod.simulate.length > 0 ? mod.simulate : mod.simulate();
            if (typeof f !== 'function') {
                throw new Error(`Simulation function for ${mod.name} must receive at least one argument`);
            }
            node.simulate = f;
        }
        return { in: inputs, out: outputs };
    };
};
const pushRecord = (record, key, value) => {
    if (record[key] === undefined) {
        record[key] = [value];
    }
    else {
        record[key].push(value);
    }
};
export const width = {
    1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8,
    9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16,
    17: 17, 18: 18, 19: 19, 20: 20, 21: 21, 22: 22, 23: 23, 24: 24,
    25: 25, 26: 26, 27: 27, 28: 28, 29: 29, 30: 30, 31: 31, 32: 32,
};
export const high4 = (data) => {
    return [data[0], data[1], data[2], data[3]];
};
export const low4 = (data) => {
    const len = data.length;
    return [data[len - 4], data[len - 3], data[len - 2], data[len - 1]];
};
export const extend4 = (baseComp, inputPins, outputPin, name, circuit) => {
    return createModule({
        name,
        inputs: inputPins.reduce((acc, pin) => {
            acc[pin] = 4;
            return acc;
        }, {}),
        outputs: { [outputPin]: width[4] },
        connect(inp, out) {
            const c3 = baseComp();
            const c2 = baseComp();
            const c1 = baseComp();
            const c0 = baseComp();
            for (const inputPin of inputPins) {
                /// @ts-ignore
                c0.in[inputPin] = inp[inputPin][3];
                /// @ts-ignore
                c1.in[inputPin] = inp[inputPin][2];
                /// @ts-ignore
                c2.in[inputPin] = inp[inputPin][1];
                /// @ts-ignore
                c3.in[inputPin] = inp[inputPin][0];
            }
            // @ts-ignore
            out[outputPin] = [c3.out[outputPin], c2.out[outputPin], c1.out[outputPin], c0.out[outputPin]];
        },
    }, circuit);
};
export const extend8 = (baseComp, inputPins, outputPin, name, circuit) => {
    return createModule({
        name,
        inputs: inputPins.reduce((acc, pin) => {
            acc[pin] = 8;
            return acc;
        }, {}),
        outputs: { [outputPin]: width[8] },
        connect(inp, out) {
            const hi = baseComp();
            const lo = baseComp();
            for (const inputPin of inputPins) {
                /// @ts-ignore
                hi.in[inputPin] = high4(inp[inputPin]);
                /// @ts-ignore
                lo.in[inputPin] = low4(inp[inputPin]);
            }
            // @ts-ignore
            out[outputPin] = [...hi.out[outputPin], ...lo.out[outputPin]];
        },
    }, circuit);
};
export const gen = (count, factory) => {
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(factory(i));
    }
    return result;
};
export const rep4 = (c) => {
    return [c, c, c, c];
};
export const rep8 = (c) => {
    return [c, c, c, c, c, c, c, c];
};
export const bin = (n, width) => {
    return n
        .toString(2)
        .slice(0, width)
        .padStart(width, '0')
        .split('')
        .map(x => x === '1' ? 1 : 0);
};
