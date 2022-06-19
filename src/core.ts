import { assert, Iter, last, pushRecord, Range, RangeInclusive, shallowEqualObject, Tuple } from "./utils";

export type Circuit = {
  modules: CircuitModules,
  signatures: CircuitSignatures,
  nets: CircuitNets,
};

export type CircuitNets = Map<string, { in: string[], out: string[], id: ModuleId }>;

export type CircuitSignatures = Map<string, {
  inputs: Record<string, Num>,
  outputs: Record<string, Num>,
  kicad?: KiCadConfig<any, any>,
}>;

export type CircuitModules = Map<ModuleId, ModuleNode>;

export type Module<In extends Record<string, number>, Out extends Record<string, number>> = {
  in: MapConnections<In>,
  out: MapConnections<Out>,
};

export type ModuleWithMetadata<In extends Record<string, number>, Out extends Record<string, number>> = Module<In, Out> & {
  meta: {
    id: ModuleId,
    circuit: Circuit,
  },
};

// tri-state
// https://en.wikipedia.org/wiki/Three-state_logic
export type State = 0 | 1 | 'x';

export const State = {
  zero: 0 as State,
  one: 1 as State,
  x: 'x' as State,
  from: (b: boolean): State => b ? 1 : 0,
  gen: <N extends number>(count: N, factory: (n: number) => Connection): N extends 1 ? State : Tuple<State, N> => {
    if (count === 1) {
      return factory(0) as any;
    }

    const result = Array<Connection>(count);

    for (let i = 0; i < count; i++) {
      result[i] = factory(i);
    }

    return result as any;
  },
};

export type Connection = RawConnection | State;

export type Multi = Exclude<Num, 0 | 1>;

export type IO<N extends number> = N extends 1 ? Connection : Tuple<Connection, N>;

export const IO = {
  gen: <N extends number>(count: N, factory: (n: number) => Connection): IO<N> => {
    if (count === 1) {
      return factory(0) as IO<N>;
    }

    const result = Array<Connection>(count);

    for (let i = 0; i < count; i++) {
      result[i] = factory(i);
    }

    return result as IO<N>;
  },
  map: <N extends number>(connections: IO<N>, f: (c: Connection, index: number) => Connection): IO<N> => {
    const res = IO.asArray(connections).map(f);

    return (res.length === 1 ? res[0] : res) as IO<N>;
  },
  width: <N extends Num>(connections: IO<N>): N => {
    return (Array.isArray(connections) ? connections.length : 1) as N;
  },
  at: <N extends number>(connections: IO<N>, index: number): Connection => {
    assert(index >= 0 && index < IO.width(connections), 'IO.at: index out of range');
    return Array.isArray(connections) ? connections[index] : connections;
  },
  forward: <
    Pins extends keyof Mapping,
    Mapping extends Record<Pins, IO<number>>,
    Mods extends Module<Record<Pins, number>, any>[]
  >(
    mapping: Mapping,
    modules: Mods
  ): void => {
    const entries = Object.entries(mapping);

    for (const mod of modules) {
      for (const [pin, connection] of entries) {
        /// @ts-ignore
        mod.in[pin] = connection;
      }
    }
  },
  repeat: <N extends number>(count: N, c: Connection): IO<N> => {
    return IO.gen(count, () => c);
  },
  asArray: (io: IO<Num>): Connection[] => {
    return Array.isArray(io) ? io : [io];
  },
  asTuple: <InpOut extends IO<Num>>(io: InpOut): Tuple<Connection, InpOut extends any[] ? InpOut['length'] : 1> => {
    return (Array.isArray(io) ? io : [io]) as any;
  },
  linearizePinout: (pins: Record<string, Num>, startIndexAtOne = false): string[] => {
    const linearized: string[] = [];
    const notLinearized: string[] = [];

    for (const [pin, width] of Object.entries(pins)) {
      if (width === 1) {
        notLinearized.push(pin);
      } else {
        const start = startIndexAtOne ? 1 : 0;
        const end = startIndexAtOne ? (width + 1) as Num : width;
        Range.iter(start, end, n => {
          linearized.push(`${pin}${n}`);
        });
      }
    }

    for (const pin of notLinearized) {
      if (linearized.includes(pin)) {
        throw new Error(`Conflicting linearized pin name: ${pin}`);
      }
    }

    if (linearized.length === 0) {
      return notLinearized;
    }

    return [...notLinearized, ...linearized];
  },
};

export type MapConnections<T extends Record<string, number>> = {
  [Pin in keyof T]: IO<T[Pin]>
};

export type MapStates<T extends Record<string, number>> = {
  [Pin in keyof T]: T[Pin] extends 1 ? State : Tuple<State, T[Pin]>
};

export type ModuleId = number;

export type RawConnection = {
  modId: ModuleId,
  pin: string,
};

export type ModuleNode = {
  id: ModuleId,
  subModules: ModuleNode[],
  name: string,
  pins: {
    in: Record<string, RawConnection[]>,
    out: Record<string, RawConnection[]>,
  },
  simulate?: (inputs: object, outputs: object, state: object) => void,
  state?: object,
};

export type NodeStateConst = { type: 'const', value: State, initialized: boolean };
export type NodeStateRef = { type: 'ref', ref: Net };
export type NodeStateMultiRef = { type: 'refs', refs: Net[] };
export type NodeState = NodeStateConst | NodeStateRef | NodeStateMultiRef;
export type Net = string;
export type CircuitState = Record<string, NodeState>;

export const Net = {
  modId(net: Net): ModuleId {
    return Number(net.split(':')[1]);
  },
  pin(net: Net): string {
    return net.split(':')[0];
  },
  decompose(net: Net): [string, ModuleId] {
    return [Net.pin(net), Net.modId(net)];
  },
};

type GlobalState = {
  circuit: Circuit,
  nextId: number,
  subModulesStack: ModuleNode[][],
};

const circuit: Circuit = {
  modules: new Map(),
  nets: new Map(),
  signatures: new Map(),
};

const globalState: GlobalState = {
  circuit,
  nextId: 0,
  subModulesStack: [],
};

export const GlobalState = {
  state: globalState,
  reset: () => {
    globalState.nextId = 0;
    globalState.subModulesStack = [];
    globalState.circuit.modules.clear();
    globalState.circuit.nets.clear();

    createPowerModule();
  },
};

const nextId = () => globalState.nextId++;

export const isRawConnection = (x: any): x is RawConnection => {
  return (
    typeof x === 'object' &&
    typeof x.modId === 'number' &&
    typeof x.pin === 'string'
  );
};

export const isNodeState = (x: any): x is NodeState => {
  if (typeof x !== 'object') { return false; }
  if (x.type !== 'const' && x.type !== 'ref') { return false; }

  if (x.type === 'const') {
    return x.value === 0 || x.value === 1 || x.value === 'x';
  }

  return typeof x.ref === 'string';
};

export const CoreUtils = {
  rawFrom: (v: Connection): RawConnection => {
    if (v === 'x') {
      throw new Error(`Called rawFrom with 'x'`);
    }

    return v === 0 ? { pin: 'gnd', modId: POWER_MODULE_ID } :
      v === 1 ? { pin: 'vcc', modId: POWER_MODULE_ID } :
        v;
  },
  connect: (circuit: Circuit, modId: ModuleId, dir: 'in' | 'out', pin: string, target: Connection) => {
    if (target !== 'x') {
      target = CoreUtils.rawFrom(target);

      if (!isRawConnection(target)) {
        const mod = circuit.modules.get(modId);
        throw new Error(`Invalid connection for ${mod?.name}.${pin}`);
      }

      const net = `${pin}:${modId}`;
      const targetNet = `${target.pin}:${target.modId}`;

      pushRecord(circuit.modules.get(modId)!.pins[dir], pin, target);

      if (!circuit.nets.has(net)) {
        circuit.nets.set(net, { in: [], out: [], id: modId });
      }

      if (!circuit.nets.has(targetNet)) {
        circuit.nets.set(targetNet, { in: [], out: [], id: target.modId });
      }

      circuit.nets.get(net)!.in.push(targetNet);
      circuit.nets.get(targetNet)!.out.push(net);
    }
  },
  pinDirection: (circuit: Circuit, modId: ModuleId, pin: string): 'in' | 'out' => {
    const module = circuit.modules.get(modId)!;
    const sig = circuit.signatures.get(module.name)!;

    if (Object.keys(sig.inputs).includes(pin)) {
      return 'in';
    }

    if (Object.keys(sig.outputs).includes(pin)) {
      return 'out';
    }

    throw new Error(`Pin ${pin} is notLinearized: string[] = []; defined in module ${module.name}`);
  },
};

// TODO:
export const createModuleGroup = <T>(name: string, f: () => T): T => {
  return f();
};

export const createBus = <N extends Num>(name: string, width: N) => {
  const busModule = defineModule({
    name,
    inputs: { d: width },
    outputs: { q: width },
    connect({ d }, out) {
      out.q = d;
    }
  })();

  return {
    read(): IO<N> {
      return busModule.out.q;
    },
    connect(...ds: IO<N>[]): void {
      ds.forEach(d => {
        busModule.in.d = d;
      });
    },
  };
};

const connectionHandler = (id: number, mod: ModuleDef<any, any, any>, circuit: Circuit, isInput: boolean): ProxyHandler<any> => {
  const sig = mod[isInput ? 'inputs' : 'outputs'];
  const prefix = isInput ? 'in' : 'out';

  const assignmentHandler = (_: any, pin: string | symbol, value: any, index?: number) => {
    if (typeof pin !== 'string') {
      throw new Error(`Pin name must be a string`);
    }

    const outputWidth = Array.isArray(value) ? value.length : 1;
    let expectedWidth = sig[pin];

    if (index !== undefined) {
      pin += `${expectedWidth - index - 1}`;
      expectedWidth = 1;
    }

    if (outputWidth !== expectedWidth) {
      throw new Error(`Incorrect pin width for ${mod.name}.${prefix}.${pin}, expected ${expectedWidth}, got ${outputWidth}`);
    }

    if (Array.isArray(value)) {
      value.forEach((value, n) => {
        const net = `${pin as string}${expectedWidth - n - 1}`;
        CoreUtils.connect(circuit, id, isInput ? 'in' : 'out', net, value);
      });

      return true;
    } else {
      CoreUtils.connect(circuit, id, isInput ? 'in' : 'out', pin, value);
    }

    return true;
  };

  return {
    get: (_, pin) => {
      if (typeof pin !== 'string') {
        throw new Error(`Pin name must be a string`);
      }

      const width = sig[pin];

      if (width === 1) {
        return { modId: id, pin };
      } else {
        const out: RawConnection[] = [];
        for (let n = 0; n < width; n++) {
          out.push({ modId: id, pin: `${pin}${width - n - 1}` });
        }

        return new Proxy(out, {
          set: (_, index, value) => {
            if (!(/[0-9]+/.test(String(index)))) {
              throw new Error(`index must be a number, got ${String(index)}`);
            }

            return assignmentHandler(out, pin, value, Number(index));
          }
        });
      }
    },
    set: (target, prop, value) => assignmentHandler(target, prop, value),
  };
};

const isCompoundModuleDef = <
  In extends Record<string, Num>,
  Out extends Record<string, Num>
>(def: BaseModuleDef<In, Out>): def is CompoundModuleDef<In, Out> => {
  return 'connect' in def;
};

const isSimulatedModuleDef = <
  In extends Record<string, Num>,
  Out extends Record<string, Num>
>(def: BaseModuleDef<In, Out>): def is SimulatedModuleDef<In, Out, any> => {
  return 'simulate' in def;
};

export function defineModule<
  In extends Record<string, Num>,
  Out extends Record<string, Num>
>(def: Omit<CompoundModuleDef<In, Out>, 'type'>): (() => Module<In, Out>);
export function defineModule<
  In extends Record<string, Num>,
  Out extends Record<string, Num>,
  State extends {}
>(def: Omit<SimulatedModuleDef<In, Out, State>, 'type'>): (() => Module<In, Out>);
export function defineModule<In extends Record<string, Num>, Out extends Record<string, Num>, State extends {}>(
  def: Omit<CompoundModuleDef<In, Out> | SimulatedModuleDef<In, Out, State>, 'type'>
): (() => Module<In, Out>) {
  const _defineModule = <
    In extends Record<string, Num>,
    Out extends Record<string, Num>,
    State extends {}
  >(
    mod: ModuleDef<In, Out, State>
  ): (() => Module<In, Out>) => {
    const { circuit } = globalState;
    const duplicatePin = Object.keys(mod.inputs).find(pin => mod.outputs[pin] !== undefined);

    if (duplicatePin != undefined) {
      throw new Error(`Duplicate pin '${duplicatePin}' in module '${mod.name}'`);
    }

    if (!circuit.signatures.has(mod.name)) {
      circuit.signatures.set(mod.name, {
        inputs: mod.inputs,
        outputs: mod.outputs,
        kicad: mod.kicad,
      });
    } else {
      const prevSig = circuit.signatures.get(mod.name)!;
      const sameInputs = shallowEqualObject(mod.inputs, prevSig.inputs);
      const sameOutputs = shallowEqualObject(mod.outputs, prevSig.outputs);

      if (!sameInputs || !sameOutputs) {
        throw new Error(`Duplicate module definition with mismatching signature for '${mod.name}'`);
      }
    }

    // ensure pin names are valid
    Object.keys({ ...mod.inputs, ...mod.outputs }).forEach(pinName => {
      if (pinName.includes(':')) {
        throw new Error(`Invalid pin name: '${pinName}' in module '${mod.name}', ':' is forbidden`);
      }
    });

    return () => {
      const id = nextId();
      const pins: ModuleNode['pins'] = { in: {}, out: {} };
      const mergedPins = { ...mod.inputs, ...mod.outputs };
      const linearizedPins = IO.linearizePinout(mergedPins);

      for (const pin of linearizedPins) {
        circuit.nets.set(`${pin}:${id}`, { in: [], out: [], id });
      }

      const node: ModuleNode = {
        id,
        name: mod.name,
        pins,
        subModules: [],
      };

      circuit.modules.set(id, node);

      const inputs = new Proxy({}, connectionHandler(id, mod, circuit, true));
      const outputs = new Proxy({}, connectionHandler(id, mod, circuit, false));

      last(globalState.subModulesStack)?.push(node);

      // register connections
      if (mod.type === 'compound') {
        globalState.subModulesStack.push(node.subModules);
        mod.connect(inputs, outputs);
        globalState.subModulesStack.pop();

        for (const [pin, width] of Object.entries(mod.outputs)) {
          if (width === 1) {
            if (pins.out[pin] === undefined) {
              throw new Error(`Unconnected output pin '${pin}' in module '${mod.name}'`);
            }
          } else {
            for (let n = 0; n < width; n++) {
              const key = `${pin}${width - n - 1}`;
              if (pins.out[key] === undefined) {
                throw new Error(`Unconnected output pin '${key}' in module '${mod.name}'`);
              }
            }
          }
        }
      }

      if (mod.type === 'simulated') {
        /// @ts-ignore
        node.simulate = mod.simulate;
        node.state = mod.state;
      }

      return {
        in: inputs,
        out: outputs,
        meta: { id, circuit },
      };
    };
  };

  if (isCompoundModuleDef(def)) {
    return _defineModule({ ...def, type: 'compound' });
  } else if (isSimulatedModuleDef(def)) {
    return _defineModule({ ...def, type: 'simulated' });
  }

  throw new Error(`Invalid module definition: ${JSON.stringify(def)}`);
}

export const metadata = <
  In extends Record<string, number>,
  Out extends Record<string, number>
>(mod: Module<In, Out>): ModuleWithMetadata<In, Out>['meta'] => {
  return (mod as ModuleWithMetadata<In, Out>).meta;
};

export const POWER_MODULE_NAME = 'power';

const createPowerModule = defineModule({
  name: POWER_MODULE_NAME,
  inputs: {},
  outputs: { vcc: 1, gnd: 1 },
  simulate(_, out) {
    out.vcc = 1;
    out.gnd = 0;
  }
});

// initialize gnd and vcc
const powerMod = createPowerModule();

export const POWER_MODULE_ID: ModuleId = metadata(powerMod).id;

// ensure that all pins (exepted the primary inputs/outputs) are connected
export const checkConnections = (topMod: Module<{}, {}>): void => {
  const { circuit, id: topModId } = metadata(topMod);
  // check connections for the top module and primitive modules
  for (const mod of Iter.filter(circuit.modules.values(), m => m.id !== topModId && m.simulate == null)) {
    const sig = circuit.signatures.get(mod.name)!;
    [true, false].forEach(isInput => {
      for (const [pin, width] of Object.entries(sig[isInput ? 'inputs' : 'outputs'])) {
        const pins: string[] = [];

        if (width === 1) {
          pins.push(pin);
        } else {
          for (let n = 0; n < width; n++) {
            pins.push(`${pin}${n}`);
          }
        }

        for (const pin of pins) {
          const connections = mod.pins[isInput ? 'in' : 'out'][pin];
          if (!Array.isArray(connections) || connections.length === 0) {
            throw new Error(`Unconnected ${isInput ? 'input' : 'output'} pin '${pin}' in module '${mod.name}'`);
          }
        }
      }
    });
  }
};

type LinearizePins<Pins extends Record<string, Num>> = {
  [Pin in keyof Pins]: Pin extends string ? (Pins[Pin] extends 1 ? Pin : `${Pin}${RangeInclusive<1, Pins[Pin]>}`) : never
}[keyof Pins];

export type KiCadConfig<In extends Record<string, Num>, Out extends Record<string, Num>> = {
  symbol: string,
  footprint: string,
  pins?: Record<number, LinearizePins<In & Out>>,
};

type BaseModuleDef<In extends Record<string, Num>, Out extends Record<string, Num>> = {
  name: string,
  inputs: In,
  outputs: Out,
  kicad?: KiCadConfig<In, Out>,
};

export type SimulatedModuleDef<
  In extends Record<string, Num>,
  Out extends Record<string, Num>,
  State extends {}
  > = BaseModuleDef<In, Out> & {
    type: 'simulated',
    state?: State,
    simulate: (inputs: MapStates<In>, outputs: MapStates<Out>, state: State) => void,
  };

export type CompoundModuleDef<In extends Record<string, Num>, Out extends Record<string, Num>> = BaseModuleDef<In, Out> & {
  type: 'compound',
  connect: (inputs: MapConnections<In>, outputs: MapConnections<Out>) => void,
};

export type ModuleDef<
  In extends Record<string, Num>,
  Out extends Record<string, Num>,
  State extends {}
  > =
  | SimulatedModuleDef<In, Out, State>
  | CompoundModuleDef<In, Out>;

export type Subtract<B extends number, A extends number, Acc extends number = 0> = A extends B ? Acc : Subtract<B, Successor<A>, Successor<Acc>>;

export type Num =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
  | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31
  | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47
  | 48 | 49 | 50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60 | 61 | 62 | 63
  | 64 | 65 | 66 | 67 | 68 | 69 | 70 | 71 | 72 | 73 | 74 | 75 | 76 | 77 | 78 | 79
  | 80 | 81 | 82 | 83 | 84 | 85 | 86 | 87 | 88 | 89 | 90 | 91 | 92 | 93 | 94 | 95
  | 96 | 97 | 98 | 99 | 100 | 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 109 | 110 | 111
  | 112 | 113 | 114 | 115 | 116 | 117 | 118 | 119 | 120 | 121 | 122 | 123 | 124 | 125 | 126 | 127 | 128;

export type Successor<N extends number> =
  N extends 0 ? 1 :
  N extends 1 ? 2 :
  N extends 2 ? 3 :
  N extends 3 ? 4 :
  N extends 4 ? 5 :
  N extends 5 ? 6 :
  N extends 6 ? 7 :
  N extends 7 ? 8 :
  N extends 8 ? 9 :
  N extends 9 ? 10 :
  N extends 10 ? 11 :
  N extends 11 ? 12 :
  N extends 12 ? 13 :
  N extends 13 ? 14 :
  N extends 14 ? 15 :
  N extends 15 ? 16 :
  N extends 16 ? 17 :
  N extends 17 ? 18 :
  N extends 18 ? 19 :
  N extends 19 ? 20 :
  N extends 20 ? 21 :
  N extends 21 ? 22 :
  N extends 22 ? 23 :
  N extends 23 ? 24 :
  N extends 24 ? 25 :
  N extends 25 ? 26 :
  N extends 26 ? 27 :
  N extends 27 ? 28 :
  N extends 28 ? 29 :
  N extends 29 ? 30 :
  N extends 30 ? 31 :
  N extends 31 ? 32 :
  N extends 32 ? 33 :
  N extends 33 ? 34 :
  N extends 34 ? 35 :
  N extends 35 ? 36 :
  N extends 36 ? 37 :
  N extends 37 ? 38 :
  N extends 38 ? 39 :
  N extends 39 ? 40 :
  N extends 40 ? 41 :
  N extends 41 ? 42 :
  N extends 42 ? 43 :
  N extends 43 ? 44 :
  N extends 44 ? 45 :
  N extends 45 ? 46 :
  N extends 46 ? 47 :
  N extends 47 ? 48 :
  N extends 48 ? 49 :
  N extends 49 ? 50 :
  N extends 50 ? 51 :
  N extends 51 ? 52 :
  N extends 52 ? 53 :
  N extends 53 ? 54 :
  N extends 54 ? 55 :
  N extends 55 ? 56 :
  N extends 56 ? 57 :
  N extends 57 ? 58 :
  N extends 58 ? 59 :
  N extends 59 ? 60 :
  N extends 60 ? 61 :
  N extends 61 ? 62 :
  N extends 62 ? 63 :
  N extends 63 ? 64 :
  N extends 64 ? 65 :
  N extends 65 ? 66 :
  N extends 66 ? 67 :
  N extends 67 ? 68 :
  N extends 68 ? 69 :
  N extends 69 ? 70 :
  N extends 70 ? 71 :
  N extends 71 ? 72 :
  N extends 72 ? 73 :
  N extends 73 ? 74 :
  N extends 74 ? 75 :
  N extends 75 ? 76 :
  N extends 76 ? 77 :
  N extends 77 ? 78 :
  N extends 78 ? 79 :
  N extends 79 ? 80 :
  N extends 80 ? 81 :
  N extends 81 ? 82 :
  N extends 82 ? 83 :
  N extends 83 ? 84 :
  N extends 84 ? 85 :
  N extends 85 ? 86 :
  N extends 86 ? 87 :
  N extends 87 ? 88 :
  N extends 88 ? 89 :
  N extends 89 ? 90 :
  N extends 90 ? 91 :
  N extends 91 ? 92 :
  N extends 92 ? 93 :
  N extends 93 ? 94 :
  N extends 94 ? 95 :
  N extends 95 ? 96 :
  N extends 96 ? 97 :
  N extends 97 ? 98 :
  N extends 98 ? 99 :
  N extends 99 ? 100 :
  N extends 100 ? 101 :
  N extends 101 ? 102 :
  N extends 102 ? 103 :
  N extends 103 ? 104 :
  N extends 104 ? 105 :
  N extends 105 ? 106 :
  N extends 106 ? 107 :
  N extends 107 ? 108 :
  N extends 108 ? 109 :
  N extends 109 ? 110 :
  N extends 110 ? 111 :
  N extends 111 ? 112 :
  N extends 112 ? 113 :
  N extends 113 ? 114 :
  N extends 114 ? 115 :
  N extends 115 ? 116 :
  N extends 116 ? 117 :
  N extends 117 ? 118 :
  N extends 118 ? 119 :
  N extends 119 ? 120 :
  N extends 120 ? 121 :
  N extends 121 ? 122 :
  N extends 122 ? 123 :
  N extends 123 ? 124 :
  N extends 124 ? 125 :
  N extends 125 ? 126 :
  N extends 126 ? 127 :
  N extends 127 ? 128 : number;