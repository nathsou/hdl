import { Circuit, MapStates, metadata, Module, ModuleId, Net, State } from "../core";
import { withoutCompoundModules } from "./rewrite";
import { all, complementarySet } from "../utils";
import { createState, ModuleSimulationData, simulationHandler, Simulator } from "./sim";

export const levelize = (circuit: Circuit) => {
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

export const createLevelizedSimulator = <
  In extends Record<string, number>,
  Out extends Record<string, number>
>(top: Module<In, Out>): Simulator<In> => {
  const { id: topId, circuit } = metadata(top);
  const state = createState(circuit);
  const executionOrder = levelize(circuit);

  const simData: ModuleSimulationData = {
    circuit,
    state: state.raw,
    mod: circuit.modules.get(topId)!,
  };

  const inputs = new Proxy({}, simulationHandler(simData, true));
  const outputs = new Proxy({}, simulationHandler(simData, false));

  const gates = executionOrder.map(id => circuit.modules.get(id)!);

  const input = (input: MapStates<In>): void => {
    // update the input vector
    const inputNets: [Net, State][] = [];

    for (const [pin, value] of Object.entries(input)) {
      if (Array.isArray(value)) {
        value.forEach((val, index) => {
          const net = `${pin}${value.length - 1 - index}:${topId}`;
          inputNets.push([net, val]);
        });
      } else {
        inputNets.push([`${pin}:${topId}`, value]);
      }
    }

    for (const [net, newState] of inputNets) {
      state.write(net, newState);
    }

    // simulate the gates
    for (const gate of gates) {
      simData.mod = gate;
      gate.simulate!(inputs, outputs);
    }
  };

  return { input, state };
};