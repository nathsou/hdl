import { createBasicModules } from "./primitive-modules/basic";
import { filter, join, last, pushRecord } from "./utils";

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

export type NodeStateConst = { type: 'const', value: 0 | 1, initialized: boolean };
export type NodeStateRef = { type: 'ref', ref: Net, initialized: boolean };
export type NodeState = NodeStateConst | NodeStateRef;
export type Net = string;
export type CircuitState = Record<string, NodeState>;

const globalState = {
  nextId: 0,
  subModulesStack: Array<ModuleNode[]>(),
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
    const sameInputs =
      Object.keys(mod.inputs).length === Object.keys(prevSig.inputs).length &&
      Object.keys(mod.inputs).every(pin => prevSig.inputs[pin] === mod.inputs[pin]);

    const sameOutputs =
      Object.keys(mod.outputs).length === Object.keys(prevSig.outputs).length &&
      Object.keys(mod.outputs).every(pin => prevSig.outputs[pin] === mod.outputs[pin]);

    if (!sameInputs || !sameOutputs) {
      throw new Error(`Duplicate module definition with mismatching signature for '${mod.name}'`);
    }
  }

  return () => {
    const id = nextId();
    const pins: ModuleNode['pins'] = {
      in: Object.fromEntries(Object.keys(mod.inputs).map(pin => [pin, []])),
      out: Object.fromEntries(Object.keys(mod.outputs).map(pin => [pin, []])),
    };

    for (const pin of join(Object.keys(mod.inputs), Object.keys(mod.outputs))) {
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
  for (const mod of filter(circuit.modules.values(), m => m.id !== topModId && m.simulate == null)) {
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
          if (!Array.isArray(connections) || connections.length !== 1) {
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

export type Tuple<T, Len extends number> =
  Len extends 0 ? [] :
  Len extends 1 ? [T] :
  Len extends 2 ? [T, T] :
  Len extends 3 ? [T, T, T] :
  Len extends 4 ? [T, T, T, T] :
  Len extends 5 ? [T, T, T, T, T] :
  Len extends 6 ? [...Tuple<T, 5>, T] :
  Len extends 7 ? [...Tuple<T, 6>, T] :
  Len extends 8 ? [...Tuple<T, 7>, T] :
  Len extends 9 ? [...Tuple<T, 8>, T] :
  Len extends 10 ? [...Tuple<T, 9>, T] :
  Len extends 11 ? [...Tuple<T, 10>, T] :
  Len extends 12 ? [...Tuple<T, 11>, T] :
  Len extends 13 ? [...Tuple<T, 12>, T] :
  Len extends 14 ? [...Tuple<T, 13>, T] :
  Len extends 15 ? [...Tuple<T, 14>, T] :
  Len extends 16 ? [...Tuple<T, 15>, T] :
  Len extends 17 ? [...Tuple<T, 16>, T] :
  Len extends 18 ? [...Tuple<T, 17>, T] :
  Len extends 19 ? [...Tuple<T, 18>, T] :
  Len extends 20 ? [...Tuple<T, 19>, T] :
  Len extends 21 ? [...Tuple<T, 20>, T] :
  Len extends 22 ? [...Tuple<T, 21>, T] :
  Len extends 23 ? [...Tuple<T, 22>, T] :
  Len extends 24 ? [...Tuple<T, 23>, T] :
  Len extends 25 ? [...Tuple<T, 24>, T] :
  Len extends 26 ? [...Tuple<T, 25>, T] :
  Len extends 27 ? [...Tuple<T, 26>, T] :
  Len extends 28 ? [...Tuple<T, 27>, T] :
  Len extends 29 ? [...Tuple<T, 28>, T] :
  Len extends 30 ? [...Tuple<T, 29>, T] :
  Len extends 31 ? [...Tuple<T, 30>, T] :
  Len extends 32 ? [...Tuple<T, 31>, T] :
  Len extends 33 ? [...Tuple<T, 32>, T] :
  Len extends 34 ? [...Tuple<T, 33>, T] :
  Len extends 35 ? [...Tuple<T, 34>, T] :
  Len extends 36 ? [...Tuple<T, 35>, T] :
  Len extends 37 ? [...Tuple<T, 36>, T] :
  Len extends 38 ? [...Tuple<T, 37>, T] :
  Len extends 39 ? [...Tuple<T, 38>, T] :
  Len extends 40 ? [...Tuple<T, 39>, T] :
  Len extends 41 ? [...Tuple<T, 40>, T] :
  Len extends 42 ? [...Tuple<T, 41>, T] :
  Len extends 43 ? [...Tuple<T, 42>, T] :
  Len extends 44 ? [...Tuple<T, 43>, T] :
  Len extends 45 ? [...Tuple<T, 44>, T] :
  Len extends 46 ? [...Tuple<T, 45>, T] :
  Len extends 47 ? [...Tuple<T, 46>, T] :
  Len extends 48 ? [...Tuple<T, 47>, T] :
  Len extends 49 ? [...Tuple<T, 48>, T] :
  Len extends 50 ? [...Tuple<T, 49>, T] :
  Len extends 51 ? [...Tuple<T, 50>, T] :
  Len extends 52 ? [...Tuple<T, 51>, T] :
  Len extends 53 ? [...Tuple<T, 52>, T] :
  Len extends 54 ? [...Tuple<T, 53>, T] :
  Len extends 55 ? [...Tuple<T, 54>, T] :
  Len extends 56 ? [...Tuple<T, 55>, T] :
  Len extends 57 ? [...Tuple<T, 56>, T] :
  Len extends 58 ? [...Tuple<T, 57>, T] :
  Len extends 59 ? [...Tuple<T, 58>, T] :
  Len extends 60 ? [...Tuple<T, 59>, T] :
  Len extends 61 ? [...Tuple<T, 60>, T] :
  Len extends 62 ? [...Tuple<T, 61>, T] :
  Len extends 63 ? [...Tuple<T, 62>, T] :
  Len extends 64 ? [...Tuple<T, 63>, T] :
  T[];