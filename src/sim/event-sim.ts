import Queue from 'mnemonist/queue';
import { checkConnections, MapStates, metadata, Module, ModuleId, Net, State } from "../core";
import { targetPrimitiveMods, withoutCompoundModules } from './rewrite';
import { Tuple, Iter, uniq } from "../utils";
import { createState, SimulationData, simulationHandler, Simulator } from './sim';

type SimEvent = {
  net: Net,
  newState: State,
};

export const createEventDrivenSimulator = <
  In extends Record<string, number>,
  Out extends Record<string, number>
>(topModule: Module<In, Out>): Simulator<In> => {
  const { id: topId, circuit } = metadata(topModule);
  checkConnections(topModule);
  const state = createState(circuit);
  const primCircuit = withoutCompoundModules(circuit);
  const eventQueue = new Queue<SimEvent>();
  const gateQueue = new Queue<ModuleId>();
  const fanouts = new Map<Net, any>(
    Iter.map(circuit.nets.entries(), ([net, { out }]) => [
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
        if (!Iter.some(gateQueue, id => id === modId)) {
          gateQueue.enqueue(modId);
        }
      }
    }
  };

  const simData: SimulationData = {
    mod: circuit.modules.get(topId)!,
  };

  const inputs = new Proxy({}, simulationHandler(circuit, state.raw, simData, true));
  const outputs = new Proxy({}, simulationHandler(circuit, state.raw, simData, false));

  const outputNets = new Map(Iter.map(primCircuit.modules.values(), mod => {
    const outputNets: string[] = [];
    const sig = primCircuit.signatures.get(mod.name)!.outputs;

    for (const pin of Object.keys(mod.pins.out)) {
      const width = sig[pin];

      if (width === 1) {
        outputNets.push(`${pin}:${mod.id}`);
      } else {
        outputNets.push(...Tuple.gen(width, n => `${pin}${n}:${mod.id}`));
      }
    }

    return [mod.id, outputNets];
  }));

  const processGates = () => {
    while (gateQueue.size > 0) {
      const modId = gateQueue.dequeue()!;
      const mod = primCircuit.modules.get(modId)!;
      const outNets = outputNets.get(modId)!;
      const prevOutput = outNets.map(net => state.deref(net));
      simData.mod = mod;

      mod.simulate!(inputs, outputs, mod.state!);

      for (let i = 0; i < outNets.length; i++) {
        const net = outNets[i];
        const newOutput = state.deref(net);
        if (prevOutput[i] !== newOutput || !state.raw[net].initialized) {
          eventQueue.enqueue({ net, newState: newOutput });
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