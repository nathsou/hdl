import { Circuit, CircuitState, Connection, MapStates, Module, ModuleNode, Net, NodeState, State } from "../core";
import { Iter, Tuple } from "../utils";
import { createEventDrivenSimulator } from "./event-sim";
import { createLevelizedSimulator } from "./level-sim";
import { connectionToNet } from "./rewrite";

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
  },
};

export type SimulationApproach = 'levelization' | 'event-driven';

const simulatorMapping: Record<
  SimulationApproach,
  <In extends Record<string, number>, Out extends Record<string, number>>(top: Module<In, Out>) => Simulator<In>
> = {
  'levelization': createLevelizedSimulator,
  'event-driven': createEventDrivenSimulator,
};

export const createSimulator = <
  In extends Record<string, number>,
  Out extends Record<string, number>
>(top: Module<In, Out>, approach: SimulationApproach = 'event-driven') => {
  return simulatorMapping[approach](top);
};

const overwriteState = (c: NodeState, with_: State) => {
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

export type SimulationData = { mod: ModuleNode };

export const simulationHandler = (circuit: Circuit, state: CircuitState, data: SimulationData, isInput: boolean): ProxyHandler<any> => {
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
        overwriteState(state[`${pin}:${data.mod.id}`], value);
        return true;
      }

      if (Array.isArray(value)) {
        value.forEach((v, n) => {
          if (v === 0 || v === 1) {
            overwriteState(state[`${pin}${expectedWidth - n - 1}:${data.mod.id}`], v);
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