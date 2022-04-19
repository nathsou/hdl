import Queue from 'mnemonist/queue';
import { MapStates, metadata, Module, ModuleId, Net, State } from "../core";
import { targetPrimitiveMods, withoutCompoundModules } from './rewrite';
import { map, some, uniq } from "../utils";
import { createState, ModuleSimulationData, simulationHandler, Simulator } from './sim';

type SimEvent = {
  net: Net,
  newState: State,
};

export const createEventDrivenSimulator = <
  In extends Record<string, number>,
  Out extends Record<string, number>
>(topModule: Module<In, Out>): Simulator<In> => {
  const { id: topId, circuit } = metadata(topModule);
  const state = createState(circuit);
  const primCircuit = withoutCompoundModules(circuit);
  const eventQueue = new Queue<SimEvent>();
  const gateQueue = new Queue<ModuleId>();
  const fanouts = new Map<Net, any>(
    map(circuit.nets.entries(), ([net, { out }]) => [
      net,
      uniq(targetPrimitiveMods(circuit, out))
    ])
  );

  const inputSig = circuit.signatures.get(circuit.modules.get(topId)!.name)!.inputs;

  for (const [pin, width] of Object.entries(inputSig)) {
    const nets: Net[] = [];

    if (width === 1) {
      nets.push(`${pin}:${topId}`);
    } else {
      for (let i = 0; i < width; i++) {
        nets.push(`${pin}${width - 1 - i}:${topId}`);
      }
    }

    for (const net of nets) {
      const out = circuit.nets.get(net)!.out;
      fanouts.set(net, uniq(targetPrimitiveMods(circuit, out)));
    }
  }

  // add constants to the initial event queue as their output in not initialized
  // and it would never be added to the event queue otherwise since they have no inputs
  eventQueue.enqueue({ net: 'vcc:0', newState: 1 });
  eventQueue.enqueue({ net: 'gnd:0', newState: 0 });

  const input = (input: MapStates<In>): void => {
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
      if (state.deref(net) !== newState || !state.raw[net].initialized) {
        eventQueue.enqueue({ net, newState });
      }
    }

    loop();
  };

  const processEvents = () => {
    while (eventQueue.size > 0) {
      const event = eventQueue.dequeue()!;
      state.write(event.net, event.newState);
      state.raw[event.net].initialized = true;

      for (const modId of fanouts.get(event.net)!) {
        if (!some(gateQueue, id => id === modId)) {
          gateQueue.enqueue(modId);
        }
      }
    }
  };

  const simData: ModuleSimulationData = {
    circuit,
    state: state.raw,
    mod: circuit.modules.get(topId)!,
  };

  const inputs = new Proxy({}, simulationHandler(simData, true));
  const outputs = new Proxy({}, simulationHandler(simData, false));

  const processGates = () => {
    while (gateQueue.size > 0) {
      const modId = gateQueue.dequeue()!;
      const mod = primCircuit.modules.get(modId)!;
      const ouputPins = Object.keys(mod.pins.out);
      const prevOutput = ouputPins.map(pin => state.deref(`${pin}:${modId}`));
      simData.mod = mod;

      mod.simulate!(inputs, outputs);

      const newOutput = ouputPins.map(pin => state.deref(`${pin}:${modId}`));

      for (let i = 0; i < ouputPins.length; i++) {
        const net = `${ouputPins[i]}:${modId}`;
        if (prevOutput[i] !== newOutput[i] || !state.raw[net].initialized) {
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

  return { input, state };
};