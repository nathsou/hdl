import { createBasicModules } from "./primitive-modules/basic";
import { Iter, last, mapObject, pushRecord, shallowEqualObject, Tuple } from "./utils";

export type Circuit = {
  modules: CircuitModules,
  signatures: CircuitSignatures,
  nets: CircuitNets,
};

export type CircuitNets = Map<string, { in: string[], out: string[], id: ModuleId }>;

export type CircuitSignatures = Map<string, {
  inputs: Record<string, number>,
  outputs: Record<string, number>,
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

export type State = 0 | 1;
export type Connection = RawConnection | State;

export const Connection = {
  gen: <T, N extends number>(count: N, factory: (n: number) => T): MultiIO<N, T> => {
    if (count === 1) {
      return factory(0) as MultiIO<N, T>;
    }

    const result = Array<T>(count);

    for (let i = 0; i < count; i++) {
      result[i] = factory(i);
    }

    return result as MultiIO<N, T>;
  },
  forward: <
    Pins extends keyof Mapping,
    Mapping extends Record<Pins, MultiIO<number, Connection>>,
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
};

export type Num =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
  | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31
  | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47
  | 48 | 49 | 50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60 | 61 | 62 | 63
  | 64 | 65 | 66 | 67 | 68 | 69 | 70 | 71 | 72 | 73 | 74 | 75 | 76 | 77 | 78 | 79
  | 80 | 81 | 82 | 83 | 84 | 85 | 86 | 87 | 88 | 89 | 90 | 91 | 92 | 93 | 94 | 95
  | 96 | 97 | 98 | 99 | 100 | 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 109 | 110 | 111
  | 112 | 113 | 114 | 115 | 116 | 117 | 118 | 119 | 120 | 121 | 122 | 123 | 124 | 125 | 126 | 127 | 128;

export type Multi = Exclude<Num, 0 | 1>;

export type MultiIO<N extends number, T> = N extends 1 ? T : Tuple<T, N>;

export type MapConnections<T extends Record<string, number>> = {
  [Pin in keyof T]: MultiIO<T[Pin], Connection>
};

export type MapStates<T extends Record<string, number>> = {
  [Pin in keyof T]: MultiIO<T[Pin], State>
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
export type NodeState = NodeStateConst | NodeStateRef;
export type Net = string;
export type CircuitState = Record<string, NodeState>;

type GlobalState = {
  nextId: number,
  subModulesStack: ModuleNode[][],
};

const globalState: GlobalState = {
  nextId: 0,
  subModulesStack: [],
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
    return x.value === 0 || x.value === 1;
  }

  return typeof x.ref === 'string';
};

const constantsModule = (circuit: Circuit) => createPrimitiveModule({
  name: '<consts>',
  inputs: {},
  outputs: { vcc: 1, gnd: 1 },
  simulate(_, out) {
    out.vcc = 1;
    out.gnd = 0;
  }
}, circuit);

export const createCircuit = () => {
  const circuit: Circuit = {
    modules: new Map(),
    signatures: new Map(),
    nets: new Map(),
  };

  constantsModule(circuit)();

  const _createPrimitiveModule = <
    In extends Record<string, Num>,
    Out extends Record<string, Num>,
    State extends {}
  >(
    def: Omit<PrimitiveModuleDef<In, Out, State>, 'type'>
  ): (() => Module<In, Out>) => {
    return createPrimitiveModule(def, circuit);
  };

  const _createCompoundModule = <In extends Record<string, Num>, Out extends Record<string, Num>>(
    def: Omit<CompoundModuleDef<In, Out>, 'type'>
  ): (() => Module<In, Out>) => {
    return createModule(def, circuit);
  };

  return {
    circuit,
    createPrimitiveModule: _createPrimitiveModule,
    createModule: _createCompoundModule,
    primitives: createBasicModules(circuit),
  };
};

export const createPrimitiveModule = <
  In extends Record<string, Num>,
  Out extends Record<string, Num>,
  State extends {}
>(
  def: Omit<PrimitiveModuleDef<In, Out, State>, 'type'>,
  circuit: Circuit,
): (() => Module<In, Out>) => {
  return _createModule({ ...def, type: 'primitive' }, circuit);
};

export const createModule = <In extends Record<string, Num>, Out extends Record<string, Num>>(
  def: Omit<CompoundModuleDef<In, Out>, 'type'>,
  circuit: Circuit,
): (() => Module<In, Out>) => {
  return _createModule({ ...def, type: 'compound' }, circuit);
};

const connectionHandler = (id: number, mod: ModuleDef<any, any, any>, circuit: Circuit, isInput: boolean): ProxyHandler<any> => {
  const sig = mod[isInput ? 'inputs' : 'outputs'];
  const prefix = isInput ? 'in' : 'out';
  const connectionOf = (v: Connection) =>
    v === 0 ? { pin: 'gnd', modId: 0 } :
      v === 1 ? { pin: 'vcc', modId: 0 } :
        v;

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

      value = connectionOf(value);

      const connect = (modId: ModuleId, dir: 'in' | 'out', pin: string, target: RawConnection) => {
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
      };

      if (isRawConnection(value)) {
        connect(id, isInput ? 'in' : 'out', pin, value);
        return true;
      }

      if (Array.isArray(value)) {
        value.forEach((v, n) => {
          v = connectionOf(v);
          if (isRawConnection(v)) {
            const key = `${pin}${expectedWidth - n - 1}`;
            connect(id, isInput ? 'in' : 'out', key, v);
          } else {
            throw new Error(`Invalid connection for ${mod.name}.${prefix}.${pin}`);
          }
        });

        return true;
      }

      throw new Error(`Invalid pin value for ${mod.name}.${prefix}.${pin}, got ${value}`);
    },
  };
};

const _createModule = <
  In extends Record<string, Num>,
  Out extends Record<string, Num>,
  State extends {}
>(
  mod: ModuleDef<In, Out, State>,
  circuit: Circuit,
): (() => Module<In, Out>) => {
  const duplicatePin = Object.keys(mod.inputs).find(pin => mod.outputs[pin] !== undefined);

  if (duplicatePin != undefined) {
    throw new Error(`Duplicate pin '${duplicatePin}' in module '${mod.name}'`);
  }

  if (!circuit.signatures.has(mod.name)) {
    circuit.signatures.set(mod.name, {
      inputs: mod.inputs,
      outputs: mod.outputs,
    });
  } else {
    const prevSig = circuit.signatures.get(mod.name)!;
    const sameInputs = shallowEqualObject(mod.inputs, prevSig.inputs);
    const sameOutputs = shallowEqualObject(mod.outputs, prevSig.outputs);

    if (!sameInputs || !sameOutputs) {
      throw new Error(`Duplicate module definition with mismatching signature for '${mod.name}'`);
    }
  }

  return () => {
    const id = nextId();
    const pins: ModuleNode['pins'] = {
      in: mapObject(mod.inputs, () => []),
      out: mapObject(mod.outputs, () => []),
    };

    for (const pin of Iter.join(Object.keys(mod.inputs), Object.keys(mod.outputs))) {
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
      const subModules: ModuleNode[] = [];
      globalState.subModulesStack.push(subModules);
      mod.connect(inputs, outputs);
      node.subModules = subModules;
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

    if (mod.type === 'primitive') {
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

// ensure that all pins (exepted the primary inputs/outputs) are connected
export const checkConnections = (topMod: Module<any, any>): void => {
  const { circuit, id: topModId } = metadata(topMod);
  // do not check connections for the top module and primitive modules
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

export const metadata = <
  In extends Record<string, number>,
  Out extends Record<string, number>
>(mod: Module<In, Out>): ModuleWithMetadata<In, Out>['meta'] => {
  return (mod as ModuleWithMetadata<In, Out>).meta;
};

type BaseModuleDef<In extends Record<string, Num>, Out extends Record<string, Num>> = {
  name: string,
  inputs: In,
  outputs: Out,
};

export type PrimitiveModuleDef<
  In extends Record<string, Num>,
  Out extends Record<string, Num>,
  State extends {}
  > = BaseModuleDef<In, Out> & {
    type: 'primitive',
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
  | PrimitiveModuleDef<In, Out, State>
  | CompoundModuleDef<In, Out>;