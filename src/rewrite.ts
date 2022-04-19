import { Circuit, CircuitState, Connection, ModuleId, Net, RawConnection, State, Tuple } from "./core";
import { filter, join } from "./utils";

export const deref = (state: CircuitState, pin: Net): State => {
  const s = state[pin];

  if (s.type === 'const') {
    return s.value;
  }

  return deref(state, s.ref);
};

export const initState = (circuit: Circuit): CircuitState => {
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

type Ret<C extends Tuple<Connection, number> | Connection> =
  C extends Tuple<Connection, infer W> ?
  Tuple<State, W> :
  State;

export const createStateReader = (state: CircuitState) => <C extends Connection[] | Connection>(connection: C): Ret<C> => {
  if (Array.isArray(connection)) {
    return connection.map(c => c === 0 ? 0 : c === 1 ? 1 : deref(state, connectionToNet(c))) as Ret<C>;
  }

  return (connection === 0 ? 0 : connection === 1 ? 1 : deref(state, connectionToNet(connection))) as Ret<C>;
};

const isPrimitiveModule = ({ modules }: Circuit, modId: ModuleId) => modules.get(modId)!.simulate != null;

const sourceNet = (circ: Circuit, net: string): string => {
  const { id, in: inp } = circ.nets.get(net)!;

  if (inp.length > 1) {
    throw new Error(`Multiple input pins for net '${net}'`);
  }

  if (isPrimitiveModule(circ, id)) {
    return net;
  }

  if (inp.length === 0) {
    return net;
  }

  return sourceNet(circ, inp[0]);
};

export const sourceNets = (circ: Circuit, nets: string[]): string[] => {
  return nets.map(net => sourceNet(circ, net));
};

const targetPrimitiveModsAux = (circ: Circuit, net: string): ModuleId[] => {
  const { id, out } = circ.nets.get(net)!;

  if (isPrimitiveModule(circ, id)) {
    return [id];
  }

  return targetPrimitiveMods(circ, out);
};

export const targetPrimitiveMods = (circ: Circuit, nets: string[]): ModuleId[] => {
  return nets.flatMap(net => targetPrimitiveModsAux(circ, net));
};

export const netToConnection = (net: string): RawConnection => {
  const [pin, modId] = net.split(':');
  return { pin, modId: Number(modId) };
};

export const connectionToNet = (c: RawConnection): Net => {
  return `${c.pin}:${c.modId}`;
};

export const withoutCompoundModules = (circ: Circuit): Circuit => {
  const newCirc: Circuit = {
    modules: new Map(),
    nets: new Map(),
    signatures: circ.signatures,
  };

  // only keep primitive modules
  for (const [modId, node] of circ.modules.entries()) {
    if (node.simulate != null) {
      const newPins = {
        in: Object.fromEntries(
          Object.entries(node.pins.in).map(([pin, conns]) => [
            pin,
            sourceNets(circ, conns.map(connectionToNet)).map(netToConnection)
          ])
        ),
        out: Object.fromEntries(
          Object.entries(node.pins.out).map(([pin, conns]) => [
            pin,
            sourceNets(circ, conns.map(connectionToNet)).map(netToConnection)
          ])
        ),
      };

      newCirc.modules.set(modId, {
        ...node,
        pins: newPins,
      });
    }
  }

  for (const [net, io] of filter(circ.nets.entries(), ([, { id }]) => isPrimitiveModule(circ, id))) {
    newCirc.nets.set(net, {
      in: sourceNets(circ, io.in),
      out: sourceNets(circ, io.out),
      id: io.id,
    });
  }

  return newCirc;
};