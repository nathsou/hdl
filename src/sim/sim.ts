import { checkConnections, Circuit, CircuitState, Connection, MapStates, Module, ModuleNode, Net, NodeStateConst, State } from "../core";
import { deepEqualObject, Iter, Tuple } from "../utils";
import { createEventDrivenSimulator } from "./event-sim";
import { createLevelizedSimulator } from "./level-sim";
import { connectionToNet } from "./rewire";

const deref = (state: CircuitState, net: Net): State => {
  const s = state[net];

  if (s.type === 'const') {
    return s.value;
  }

  return deref(state, s.ref);
};

const writeDeref = (state: CircuitState, net: Net, newState: State): void => {
  const s = state[net];

  if (s.type === 'const') {
    s.value = newState;
    return;
  }

  writeDeref(state, s.ref, newState);
};

export const initState = (circuit: Circuit): CircuitState => {
  const state: CircuitState = {};

  for (const [id, mod] of circuit.modules.entries()) {
    const sig = circuit.signatures.get(mod.name)!;

    for (const [pin, width] of Iter.join(Object.entries(sig.inputs), Object.entries(sig.outputs))) {
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
    for (const [pin, connections] of Iter.join(Object.entries(node.pins.in), Object.entries(node.pins.out))) {
      for (const conn of connections) {
        if (circuit.modules.get(conn.modId)!.name === '__power') {
          state[`${pin}:${id}`] = {
            type: 'const',
            value: conn.pin === 'vcc' ? 1 : 0,
            initialized: false,
          };
        } else {
          state[`${pin}:${id}`] = {
            type: 'ref',
            ref: `${conn.pin}:${conn.modId}`,
          };
        }
      }
    }
  }

  return state;
};

export const createState = (circuit: Circuit) => {
  const raw = initState(circuit);

  return {
    raw,
    read: createStateReader(raw),
    deref: (net: Net) => deref(raw, net),
    write: (net: Net, newState: State) => writeDeref(raw, net, newState),
  };
};

type StateReaderRet<C extends Tuple<Connection, number> | Connection> =
  C extends Tuple<Connection, infer W> ?
  Tuple<State, W> :
  State;

const createStateReader = (state: CircuitState) => <C extends Connection[] | Connection>(connection: C): StateReaderRet<C> => {
  if (Array.isArray(connection)) {
    return connection.map(c => c === 0 ? 0 : c === 1 ? 1 : deref(state, connectionToNet(c))) as StateReaderRet<C>;
  }

  return (connection === 0 ? 0 : connection === 1 ? 1 : deref(state, connectionToNet(connection))) as StateReaderRet<C>;
};

export type Simulator<In extends Record<string, number>> = {
  input: (input: MapStates<In>) => void,
  state: {
    raw: CircuitState,
    read: <C extends Connection[] | Connection>(connection: C) => StateReaderRet<C>,
  }
};

export type SimulationApproach = 'levelization' | 'event-driven';

export type SimulationSettings = {
  approach: SimulationApproach,
  checkConnections: boolean,
};

const defaultSimulationSettings: SimulationSettings = {
  approach: 'event-driven',
  checkConnections: true,
};

export const createSimulator = <
  In extends Record<string, number>,
  Out extends Record<string, number>
>(top: Module<In, Out>, settings = defaultSimulationSettings) => {
  if (settings.checkConnections) {
    checkConnections(top);
  }

  const sim = (() => {
    switch (settings.approach) {
      case 'levelization':
        return createLevelizedSimulator(top);
      case 'event-driven':
        return createEventDrivenSimulator(top);
    }
  })();

  type InputVector<M extends Module<Record<string, number>, any>> =
  MapStates<M extends Module<infer In, any> ? In : never>;

  type OutputVector<M extends Module<any, Record<string, number>>> =
    MapStates<M extends Module<any, infer Out> ? Out : never>;

  return {
    ...sim,
    expect(input: InputVector<typeof top>, expectedOutput: OutputVector<typeof top>) {
      sim.input(input);

      const actualOutput: Record<string, State | State[]> = {};
      for (const k of Object.keys(expectedOutput)) {
        actualOutput[k] = sim.state.read(top.out[k]); 
      }
    
      if (!deepEqualObject(actualOutput, expectedOutput)) {
        throw new Error(`Invalid state for ${JSON.stringify(input)}, expected ${JSON.stringify(expectedOutput)}, got ${JSON.stringify(actualOutput)}`);
      }
    },
  };
};

type StateUpdater = (state: CircuitState, net: Net, newState: State) => void;

const createStateUpdater = (onStateChange?: (net: Net, newState: State) => void): StateUpdater => {
  if (onStateChange != null) {
    return (
      state: CircuitState,
      net: Net,
      newState: State
    ) => {
      const node = state[net] as NodeStateConst;

      if (!node.initialized) {
        node.value = newState;
        node.initialized = true;
        onStateChange(net, newState);
      } else if (node.value !== newState) {
        onStateChange(net, newState);
      }
    };
  }

  return (
    state: CircuitState,
    net: Net,
    newState: State
  ) => {
    const node = state[net] as NodeStateConst;
    node.value = newState;
  };
};

export type SimulationData = { mod: ModuleNode };

export const simulationHandler = (
  circuit: Circuit,
  state: CircuitState,
  data: SimulationData,
  isInput: boolean,
  onStateChange?: (net: Net, newState: State) => void
): ProxyHandler<any> => {
  const updateState = createStateUpdater(onStateChange);

  return {
    get: (_, pin) => {
      if (typeof pin !== 'string') {
        throw new Error(`Pin name must be a string`);
      }

      const sig = circuit.signatures.get(data.mod.name)![isInput ? 'inputs' : 'outputs'];
      const width = sig[pin];

      if (width === 1) {
        return deref(state, `${pin}:${data.mod.id}`);
      } else {
        const out: State[] = [];
        for (let n = 0; n < width; n++) {
          out.push(deref(state, `${pin}${width - n - 1}:${data.mod.id}`));
        }

        return out;
      }
    },
    set: (_, pin, value) => {
      if (typeof pin !== 'string') {
        throw new Error(`Pin name must be a string`);
      }

      const sig = circuit.signatures.get(data.mod.name)![isInput ? 'inputs' : 'outputs'];
      const prefix = isInput ? 'in' : 'out';

      const outputWidth = Array.isArray(value) ? value.length : 1;
      const expectedWidth = sig[pin];

      if (outputWidth !== expectedWidth) {
        throw new Error(`Incorrect pin width for ${data.mod.name}.${prefix}.${pin}, expected ${expectedWidth}, got ${outputWidth}`);
      }

      if (value === 0 || value === 1) {
        updateState(state, `${pin}:${data.mod.id}`, value);
        return true;
      }

      if (Array.isArray(value)) {
        value.forEach((v, n) => {
          if (v === 0 || v === 1) {
            updateState(state, `${pin}${expectedWidth - n - 1}:${data.mod.id}`, v);
          } else {
            throw new Error(`Invalid node state for ${data.mod.name}:${data.mod.id}.${prefix}.${pin}`);
          }
        });

        return true;
      }

      throw new Error(`Invalid pin value for ${data.mod.name}:${data.mod.id}.${prefix}.${pin}, got ${value}`);
    },
  };
};