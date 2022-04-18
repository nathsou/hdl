import { all, complementarySet, join } from "./utils";
export const deref = (state, pin) => {
    const s = state[pin];
    if (s.type === 'const') {
        return s.value;
    }
    return deref(state, s.ref);
};
const initState = (circuit) => {
    const state = {};
    for (const [id, mod] of circuit.modules.entries()) {
        const sig = circuit.signatures.get(mod.name);
        for (const [pin, width] of join(Object.entries(sig.inputs), Object.entries(sig.outputs))) {
            if (width === 1) {
                state[`${pin}:${id}`] = { type: 'const', value: 0 };
            }
            else {
                for (let n = 0; n < width; n++) {
                    state[`${pin}${width - n - 1}:${id}`] = { type: 'const', value: 0 };
                }
            }
        }
    }
    for (const [id, node] of circuit.modules.entries()) {
        for (const [pin, connections] of join(Object.entries(node.pins.in), Object.entries(node.pins.out))) {
            for (const conn of connections) {
                if (circuit.modules.get(conn.componentId).name === '<consts>') {
                    state[`${pin}:${id}`] = { type: 'const', value: conn.pin === 'vcc' ? 1 : 0 };
                }
                else {
                    state[`${pin}:${id}`] = {
                        type: 'ref',
                        ref: `${conn.pin}:${conn.componentId}`,
                    };
                }
            }
        }
    }
    return state;
};
const isPrimitiveModule = ({ modules }, modId) => modules.get(modId).simulate != null;
const sourceNet = (circ, net) => {
    const { id, in: inp } = circ.nets.get(net);
    if (inp.length > 1) {
        throw new Error(`Multiple input pins for net '${net}'`);
    }
    if (isPrimitiveModule(circ, id)) {
        return net;
    }
    return sourceNet(circ, inp[0]);
};
const simplifyConnections = (circ, nets) => {
    return nets.map(net => sourceNet(circ, net));
};
const netToConnection = (net) => {
    const [pin, modId] = net.split(':');
    return { pin, componentId: Number(modId) };
};
const connectionToNet = (c) => {
    return `${c.pin}:${c.componentId}`;
};
export const removeCompoundModules = (circ) => {
    const newCirc = {
        modules: new Map(),
        nets: new Map(),
        signatures: circ.signatures,
    };
    // only keep primitive modules
    for (const [modId, node] of circ.modules.entries()) {
        if (node.simulate != null) {
            const newPins = {
                in: Object.fromEntries(Object.entries(node.pins.in).map(([pin, conns]) => [
                    pin,
                    simplifyConnections(circ, conns.map(connectionToNet)).map(netToConnection)
                ])),
                out: Object.fromEntries(Object.entries(node.pins.out).map(([pin, conns]) => [
                    pin,
                    simplifyConnections(circ, conns.map(connectionToNet)).map(netToConnection)
                ])),
            };
            newCirc.modules.set(modId, Object.assign(Object.assign({}, node), { pins: newPins }));
        }
    }
    return newCirc;
};
const levelize = (circuit) => {
    const { modules: gates } = removeCompoundModules(circuit);
    const remainingGates = new Set();
    const readyGates = complementarySet(remainingGates);
    const dependencies = new Map([...gates.keys()].map(id => [id, new Set()]));
    for (const [gateId, node] of gates.entries()) {
        Object.values(node.pins.in).forEach(connections => {
            connections.forEach(c => {
                if (c.componentId !== gateId) {
                    dependencies.get(gateId).add(c.componentId);
                }
            });
        });
        remainingGates.add(gateId);
    }
    const order = [];
    while (remainingGates.size > 0) {
        const newlyReadyGates = [];
        for (const gateId of remainingGates) {
            const deps = dependencies.get(gateId);
            if (all(deps, id => readyGates.has(id))) {
                newlyReadyGates.push(gateId);
            }
        }
        if (newlyReadyGates.length === 0) {
            throw new Error('Circuit has cycles, use event-driven simulation');
        }
        for (const gateId of newlyReadyGates) {
            order.push(gateId);
            remainingGates.delete(gateId);
        }
    }
    return order;
};
export const createSim = (circ) => {
    const state = initState(circ);
    const executionOrder = levelize(circ);
    const gates = executionOrder.map(id => ({
        simulate: circ.modules.get(id).simulate,
        inp: new Proxy({}, simulationHandler(id, circ.modules.get(id), circ, state, true)),
        out: new Proxy({}, simulationHandler(id, circ.modules.get(id), circ, state, false)),
    }));
    const step = () => {
        for (const { simulate, inp, out } of gates) {
            simulate(inp, out);
        }
    };
    return { state, step };
};
const simulationHandler = (id, mod, circuit, state, isInput) => {
    const sig = circuit.signatures.get(mod.name)[isInput ? 'inputs' : 'outputs'];
    const prefix = isInput ? 'in' : 'out';
    const overwrite = (c, with_) => {
        if (c.type === 'const') {
            c.value = with_;
        }
        else {
            /// @ts-ignore
            c.type = 'const';
            /// @ts-ignore
            c.value = with_;
            /// @ts-ignore
            delete c.ref;
        }
    };
    return {
        get: (_, pin) => {
            if (typeof pin !== 'string') {
                throw new Error(`Pin name must be a string`);
            }
            const width = sig[pin];
            if (width === 1) {
                return deref(state, `${pin}:${id}`);
            }
            else {
                const out = [];
                for (let n = 0; n < width; n++) {
                    out.push(deref(state, `${pin}${width - n - 1}:${id}`));
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
            if (value === 0 || value === 1) {
                overwrite(state[`${pin}:${id}`], value);
                return true;
            }
            if (Array.isArray(value)) {
                value.forEach((v, n) => {
                    if (v === 0 || v === 1) {
                        overwrite(state[`${pin}${expectedWidth - n - 1}:${id}`], v);
                    }
                    else {
                        throw new Error(`Invalid node state for ${mod.name}:${mod.id}.${prefix}.${pin}`);
                    }
                });
                return true;
            }
            throw new Error(`Invalid pin value for ${mod.name}:${mod.id}.${prefix}.${pin}, got ${value}`);
        },
    };
};
