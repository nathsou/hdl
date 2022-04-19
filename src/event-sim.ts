import Queue from 'mnemonist/queue';
import { Circuit, CircuitState, MapStates, Module, ModuleId, ModuleWithMetadata, Net, State } from "./core";;
import { createStateReader, deref, targetPrimitiveMods, withoutCompoundModules } from './rewrite';
import { overwriteState, simulationHandler } from './sim';
import { find, join, map, some, uniq } from "./utils";

type SimEvent = {
  net: Net,
  newState: State,
};

const initState = (circuit: Circuit): CircuitState => {
  const state: CircuitState = {};

  for (const [id, mod] of circuit.modules.entries()) {
    const sig = circuit.signatures.get(mod.name)!;

    for (const [pin, width] of join(Object.entries(sig.inputs), Object.entries(sig.outputs))) {
      if (width === 1) {
        state[`${pin}:${id}`] = { type: 'const', value: 0, initialized: false };
      } else {
        for (let n = 0; n < width; n++) {
          state[`${pin}${width - n - 1}:${id}`] = { type: 'const', value: 0, initialized: false };
        }
      }
    }
  }

  for (const [id, node] of circuit.modules.entries()) {
    for (const [pin, connections] of join(Object.entries(node.pins.in), Object.entries(node.pins.out))) {
      for (const conn of connections) {
        if (circuit.modules.get(conn.modId)!.name === '<consts>') {
          state[`${pin}:${id}`] = {
            type: 'const',
            value: conn.pin === 'vcc' ? 1 : 0,
            initialized: false
          };
        } else {
          state[`${pin}:${id}`] = {
            type: 'ref',
            ref: `${conn.pin}:${conn.modId}`,
            initialized: false
          };
        }
      }
    }
  }

  return state;
};

export const createEventDrivenSim = <
  In extends Record<string, number>,
  Out extends Record<string, number>
>(topModule: Module<In, Out>) => {
  const top = topModule as ModuleWithMetadata<In, Out>;
  const circuit = top.meta.circuit;
  const state = initState(circuit);
  const primCircuit = withoutCompoundModules(circuit);
  const eventQueue = new Queue<SimEvent>();
  const gateQueue = new Queue<ModuleId>();
  const fanouts = new Map<Net, any>(
    map(circuit.nets.entries(), ([net, { out }]) => [
      net,
      uniq(targetPrimitiveMods(circuit, out))
    ])
  );

  const inputSig = circuit.signatures.get(circuit.modules.get(top.meta.id)!.name)!.inputs;

  for (const [pin, width] of Object.entries(inputSig)) {
    const nets: Net[] = [];

    if (width === 1) {
      nets.push(`${pin}:${top.meta.id}`);
    } else {
      for (let i = 0; i < width; i++) {
        nets.push(`${pin}${width - 1 - i}:${top.meta.id}`);
      }
    }

    for (const net of nets) {
      const out = circuit.nets.get(net)!.out;
      fanouts.set(net, uniq(targetPrimitiveMods(circuit, out)));
    }
  }

  // add constants to the initial event queue as their output in not initialized
  // and it would never be added to the event queue otherwise since they have no inputs
  const constants = find(primCircuit.modules.values(), n => n.name === '<consts>');
  if (constants) {
    eventQueue.enqueue({ net: `vcc:${constants.id}`, newState: 1 });
    eventQueue.enqueue({ net: `gnd:${constants.id}`, newState: 0 });
  }

  const input = (input: MapStates<In>) => {
    const nets: [Net, State][] = [];

    for (const [pin, value] of Object.entries(input)) {
      if (Array.isArray(value)) {
        value.forEach((val, index) => {
          const net = `${pin}${value.length - 1 - index}:${top.meta.id}`;
          nets.push([net, val]);
        });
      } else {
        nets.push([`${pin}:${top.meta.id}`, value]);
      }
    }

    for (const [net, newState] of nets) {
      if (deref(state, net) !== newState || !state[net].initialized) {
        eventQueue.enqueue({ net, newState });
      }
    }

    loop();
  };

  const processEvents = () => {
    while (eventQueue.size > 0) {
      const event = eventQueue.dequeue()!;
      overwriteState(state[event.net], event.newState);
      state[event.net].initialized = true;

      for (const modId of fanouts.get(event.net)!) {
        if (!some(gateQueue, id => id === modId)) {
          gateQueue.enqueue(modId);
        }
      }
    }
  };

  const processGates = () => {
    while (gateQueue.size > 0) {
      const modId = gateQueue.dequeue()!;
      const mod = primCircuit.modules.get(modId)!;
      const ouputPins = Object.keys(mod.pins.out);
      const prevOutput = ouputPins.map(pin => deref(state, `${pin}:${modId}`));

      const inp = new Proxy({}, simulationHandler(modId, mod, primCircuit, state, true));
      const out = new Proxy({}, simulationHandler(modId, mod, primCircuit, state, false));
      mod.simulate!(inp, out);

      const newOutput = ouputPins.map(pin => deref(state, `${pin}:${modId}`));

      for (let i = 0; i < ouputPins.length; i++) {
        const net = `${ouputPins[i]}:${modId}`;
        if (prevOutput[i] !== newOutput[i] || !state[net].initialized) {
          eventQueue.enqueue({ net, newState: newOutput[i] });
        }
      }
    }
  };

  const loop = () => {
    while (eventQueue.size > 0) {
      processEvents();
      if (gateQueue.size > 0) {
        processGates();
      }
    }
  };

  return { input, state: { raw: state, read: createStateReader(state) } };
};