import { Circuit, CircuitState, ModuleId, ModuleNode, NodeState, PinId, RawConnection, State } from "./core";
import { all, join } from "./utils";

export const deref = (state: CircuitState, pin: PinId): State => {
  const s = state[pin];

  if (s.type === 'const') {
    return s.value;
  }

  return deref(state, s.ref);
};

const initState = (circuit: Circuit): CircuitState => {
  const state: CircuitState = {};

  for (const [id, mod] of circuit.modules.entries()) {
    const sig = circuit.signatures.get(mod.name)!;

    for (const [pin, width] of join(Object.entries(sig.inputs), Object.entries(sig.outputs))) {
      if (width === 1) {
        state[`${pin}:${id}`] = { type: 'const', value: 0 };
      } else {
        for (let n = 0; n < width; n++) {
          state[`${pin}${width - n - 1}:${id}`] = { type: 'const', value: 0 };
        }
      }
    }
  }

  for (const [id, node] of circuit.modules.entries()) {
    for (const [pin, connections] of join(Object.entries(node.pins.in), Object.entries(node.pins.out))) {
      for (const conn of connections) {
        if (circuit.modules.get(conn.componentId)!.name === '<consts>') {
          state[`${pin}:${id}`] = { type: 'const', value: conn.pin === 'vcc' ? 1 : 0 };
        } else {
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

const isGate = (circ: Circuit, modId: ModuleId) => circ.modules.get(modId)!.simulate != null;

const sourceNet = (circ: Circuit, net: string): string => {
  const { id, in: inp } = circ.nets.get(net)!;

  if (inp.length > 1) {
    throw new Error(`Multiple input pins for net '${net}'`);
  }

  if (isGate(circ, id)) {
    return net;
  }

  return sourceNet(circ, inp[0]);
};

const simplifyConnections = (circ: Circuit, nets: string[]): string[] => {
  return nets.map(net => sourceNet(circ, net));
};

const netToConnection = (net: string): RawConnection => {
  const [pin, modId] = net.split(':');
  return { pin, componentId: Number(modId) };
};

const connectionToNet = (c: RawConnection): PinId => {
  return `${c.pin}:${c.componentId}`;
};

export const removeCompoundModules = (circ: Circuit): Circuit => {
  const newCirc: Circuit = {
    modules: new Map(),
    nets: new Map(),
    signatures: circ.signatures,
  };

  // only keep gates
  for (const [modId, node] of circ.modules.entries()) {
    if (node.simulate != null) {

      const newPins = {
        in: Object.fromEntries(
          Object.entries(node.pins.in).map(([pin, conns]) => [
            pin,
            simplifyConnections(circ, conns.map(connectionToNet)).map(netToConnection)
          ])
        ),
        out: Object.fromEntries(
          Object.entries(node.pins.out).map(([pin, conns]) => [
            pin,
            simplifyConnections(circ, conns.map(connectionToNet)).map(netToConnection)
          ])
        ),
      };

      newCirc.modules.set(modId, {
        ...node,
        pins: newPins,
      });
    }
  }

  return newCirc;
};

const levelize = (circuit: Circuit) => {
  const { modules: gates } = removeCompoundModules(circuit);

  const remainingGates = new Set<ModuleId>();
  const readyGates = new Set<ModuleId>();
  const dependencies = new Map<ModuleId, Set<ModuleId>>(
    [...gates.keys()].map(id => [id, new Set()])
  );

  for (const [gateId, node] of gates.entries()) {
    Object.values(node.pins.in).forEach(connections => {
      connections.forEach(c => {
        if (c.componentId !== gateId) {
          dependencies.get(gateId)!.add(c.componentId);
        }
      });
    });

    remainingGates.add(gateId);
  }

  const order: ModuleId[] = [];

  while (remainingGates.size > 0) {
    const newlyReadyGates: ModuleId[] = [];

    for (const gateId of remainingGates) {
      const deps = dependencies.get(gateId)!;
      if (all(deps, id => readyGates.has(id))) {
        newlyReadyGates.push(gateId);
      }
    }

    for (const gateId of newlyReadyGates) {
      order.push(gateId);
      readyGates.add(gateId);
      remainingGates.delete(gateId);
    }
  }

  return order;
};

export const createSim = (circ: Circuit) => {
  const state = initState(circ);

  const executionOrder = levelize(circ);

  const step = () => {
    for (const modId of executionOrder) {
      const mod = circ.modules.get(modId)!;
      mod.simulate!(
        new Proxy({}, simulationHandler(modId, mod, circ, state, true)),
        new Proxy({}, simulationHandler(modId, mod, circ, state, false))
      );
    }
  };

  return {
    step,
    state,
  };
};

const simulationHandler = (id: number, mod: ModuleNode, circuit: Circuit, state: CircuitState, isInput: boolean): ProxyHandler<any> => {
  const sig = circuit.signatures.get(mod.name)![isInput ? 'inputs' : 'outputs'];
  const prefix = isInput ? 'in' : 'out';

  const overwrite = (c: NodeState, with_: State) => {
    if (c.type === 'const') {
      c.value = with_;
    } else {
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
      } else {
        const out: State[] = [];
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
          } else {
            throw new Error(`Invalid node state for ${mod.name}:${mod.id}.${prefix}.${pin}`);
          }
        });

        return true;
      }

      throw new Error(`Invalid pin value for ${mod.name}:${mod.id}.${prefix}.${pin}, got ${value}`);
    },
  };
};