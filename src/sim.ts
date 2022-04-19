import { Circuit, CircuitState, ModuleId, ModuleNode, NodeState, State } from "./core";
import { deref, initState, withoutCompoundModules } from "./rewrite";
import { all, complementarySet } from "./utils";

const levelize = (circuit: Circuit) => {
  const { modules: gates } = withoutCompoundModules(circuit);

  const remainingGates = new Set<ModuleId>();
  const readyGates = complementarySet(remainingGates);
  const dependencies = new Map<ModuleId, Set<ModuleId>>(
    [...gates.keys()].map(id => [id, new Set()])
  );

  for (const [gateId, node] of gates.entries()) {
    Object.values(node.pins.in).forEach(connections => {
      connections.forEach(c => {
        if (c.modId !== gateId) {
          dependencies.get(gateId)!.add(c.modId);
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

    if (newlyReadyGates.length === 0) {
      throw new Error('Circuit has feedback loops, use event-driven simulation instead.');
    }

    for (const gateId of newlyReadyGates) {
      order.push(gateId);
      remainingGates.delete(gateId);
    }
  }

  return order;
};

export const createSim = (circ: Circuit) => {
  const state = initState(circ);
  const executionOrder = levelize(circ);
  const gates = executionOrder.map(id => ({
    simulate: circ.modules.get(id)!.simulate!,
    inp: new Proxy({}, simulationHandler(id, circ.modules.get(id)!, circ, state, true)),
    out: new Proxy({}, simulationHandler(id, circ.modules.get(id)!, circ, state, false)),
  }));

  const step = () => {
    for (const { simulate, inp, out } of gates) {
      simulate(inp, out);
    }
  };

  return { state, step };
};

export const overwriteState = (c: NodeState, with_: State) => {
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

export const simulationHandler = (id: number, mod: ModuleNode, circuit: Circuit, state: CircuitState, isInput: boolean): ProxyHandler<any> => {
  const sig = circuit.signatures.get(mod.name)![isInput ? 'inputs' : 'outputs'];
  const prefix = isInput ? 'in' : 'out';

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
        overwriteState(state[`${pin}:${id}`], value);
        return true;
      }

      if (Array.isArray(value)) {
        value.forEach((v, n) => {
          if (v === 0 || v === 1) {
            overwriteState(state[`${pin}${expectedWidth - n - 1}:${id}`], v);
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