import { Circuit, CircuitState, Connection, ModuleId, Net, RawConnection, State, Tuple } from "../core";
import { filter, join } from "../utils";

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