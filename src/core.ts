import { createBasicModules } from "./primitive-modules/basic";
import { join, pushRecord } from "./utils";

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

export type MapConnections<T extends Record<string, number>> = {
  [Pin in keyof T]: T[Pin] extends 1 ? Connection : Tuple<Connection, T[Pin]>
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
  simulate?: (inputs: object, outputs: object) => void,
};

export type NodeStateConst = { type: 'const', value: 0 | 1, initialized: boolean };
export type NodeStateRef = { type: 'ref', ref: Net, initialized: boolean };
export type NodeState = NodeStateConst | NodeStateRef;
export type Net = string;
export type CircuitState = Record<string, NodeState>;

let _nextId = 0;
const nextId = () => _nextId++;

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
  outputs: { vcc: width[1], gnd: width[1] },
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

  const _createPrimitiveModule = <In extends Record<string, number>, Out extends Record<string, number>>(
    def: Omit<PrimitiveModuleDef<In, Out>, 'type'>
  ): (() => Module<In, Out>) => {
    return createPrimitiveModule(def, circuit);
  };

  const _createCompoundModule = <In extends Record<string, number>, Out extends Record<string, number>>(
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

export const createPrimitiveModule = <In extends Record<string, number>, Out extends Record<string, number>>(
  def: Omit<PrimitiveModuleDef<In, Out>, 'type'>,
  circuit: Circuit,
): (() => Module<In, Out>) => {
  return _createModule({ ...def, type: 'primitive' }, circuit);
};

export const createModule = <In extends Record<string, number>, Out extends Record<string, number>>(
  def: Omit<CompoundModuleDef<In, Out>, 'type'>,
  circuit: Circuit,
): (() => Module<In, Out>) => {
  return _createModule({ ...def, type: 'compound' }, circuit);
};

const connectionHandler = (id: number, mod: ModuleDef<any, any>, circuit: Circuit, isInput: boolean): ProxyHandler<any> => {
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

const subModulesStack: ModuleNode[][] = [];

const _createModule = <In extends Record<string, number>, Out extends Record<string, number>>(
  mod: ModuleDef<In, Out>,
  circuit: Circuit,
): (() => Module<In, Out>) => {
  if (circuit.signatures.has(mod.name)) {
    throw new Error(`Module ${mod.name} already defined`);
  }

  const duplicatePin = Object.keys(mod.inputs).find(pin => mod.outputs[pin] !== undefined);

  if (duplicatePin != undefined) {
    throw new Error(`Duplicate pin '${duplicatePin}' in module '${mod.name}'`);
  }

  circuit.signatures.set(mod.name, {
    inputs: mod.inputs,
    outputs: mod.outputs,
  });

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
    subModulesStack.at(-1)?.push(node);

    // register connections
    if (mod.type === 'compound') {
      const subModules: ModuleNode[] = [];
      subModulesStack.push(subModules);
      mod.connect(inputs, outputs);
      node.subModules = subModules;
      subModulesStack.pop();

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
      const f = mod.simulate.length > 0 ? mod.simulate : (mod.simulate as Function)();

      if (typeof f !== 'function') {
        throw new Error(`Simulation function for ${mod.name} must receive at least one argument`);
      }

      node.simulate = f;
    }

    return {
      in: inputs,
      out: outputs,
      meta: { id, circuit },
    };
  };
};

export const metadata = <
  In extends Record<string, number>,
  Out extends Record<string, number>
>(mod: Module<In, Out>): ModuleWithMetadata<In, Out>['meta'] => {
  return (mod as ModuleWithMetadata<In, Out>).meta;
};

type BaseModuleDef<In extends Record<string, number>, Out extends Record<string, number>> = {
  name: string,
  inputs: In,
  outputs: Out,
};

export type PrimitiveModuleDef<In extends Record<string, number>, Out extends Record<string, number>> = BaseModuleDef<In, Out> & {
  type: 'primitive',
  simulate: ((inputs: MapStates<In>, outputs: MapStates<Out>) => void) | (() => (inputs: MapStates<In>, outputs: MapStates<Out>) => void),
};

export type CompoundModuleDef<In extends Record<string, number>, Out extends Record<string, number>> = BaseModuleDef<In, Out> & {
  type: 'compound',
  connect: (inputs: MapConnections<In>, outputs: MapConnections<Out>) => void,
};

export type ModuleDef<In extends Record<string, number>, Out extends Record<string, number>> =
  | PrimitiveModuleDef<In, Out>
  | CompoundModuleDef<In, Out>;

export const width = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8,
  9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16,
  17: 17, 18: 18, 19: 19, 20: 20, 21: 21, 22: 22, 23: 23, 24: 24,
  25: 25, 26: 26, 27: 27, 28: 28, 29: 29, 30: 30, 31: 31, 32: 32,
} as const;

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
  T[];