import CircularBuffer from 'mnemonist/circular-buffer';
import Queue from 'mnemonist/queue';
import { MapStates, metadata, Module, ModuleId, Net, NodeStateConst, State } from "../core";
import { Iter, uniq } from "../utils";
import { Rewire } from './rewire';
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
  const state = createState(circuit);
  const primCircuit = Rewire.keepPrimitiveModules(circuit);
  const eventQueue = new Queue<SimEvent>();
  const maxModId = circuit.modules.size - 1;
  const moduleQueue = new CircularBuffer<ModuleId>(
    maxModId < 256 ? Uint8Array : maxModId < 65536 ? Uint16Array : Uint32Array,
    primCircuit.modules.size
  );
  const modulesInQueue = new Set<ModuleId>();
  const fanouts = new Map<Net, ModuleId[]>(
    Iter.map(circuit.nets.entries(), ([net, { out }]) => [
      net,
      uniq(Rewire.filterOutputs(circuit, out, node => node.simulate != null))
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
      fanouts.set(net, uniq(Rewire.filterOutputs(circuit, out, node => node.simulate != null)));
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
      const sta = state.raw[net] as NodeStateConst;
      if (sta.value !== newState || !sta.initialized) {
        eventQueue.enqueue({ net, newState });
      }
    }

    loop();
  };

  const processEvents = () => {
    while (eventQueue.size > 0) {
      const event = eventQueue.dequeue()!;
      const sta = state.raw[event.net] as NodeStateConst;
      sta.value = event.newState;

      const fanout = fanouts.get(event.net)!;
      for (let i = 0; i < fanout.length; i++) {
        let modId = fanout[i];
        if (!modulesInQueue.has(modId)) {
          modulesInQueue.add(modId);
          moduleQueue.unshift(modId);
        }
      }
    }

    modulesInQueue.clear();
  };

  const simData: SimulationData = {
    mod: circuit.modules.get(topId)!,
  };

  const onStateChange = (net: Net, newState: State): void => {
    eventQueue.enqueue({ net, newState });
  };

  const inputs = new Proxy({}, simulationHandler(circuit, state.raw, simData, true, onStateChange));
  const outputs = new Proxy({}, simulationHandler(circuit, state.raw, simData, false, onStateChange));

  const processModules = () => {
    while (moduleQueue.size > 0) {
      const modId = moduleQueue.pop()!;
      const mod = primCircuit.modules.get(modId)!;
      simData.mod = mod;
      mod.simulate!(inputs, outputs, mod.state!);
    }
  };

  const loop = () => {
    while (eventQueue.size > 0) {
      processEvents();
      processModules();
    }
  };

  return { input, state };
};