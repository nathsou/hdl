import { Circuit, ModuleId, Net, RawConnection } from "../core";
import { Iter, mapObject } from "../utils";

const isPrimitiveModule = ({ modules }: Circuit, modId: ModuleId) => modules.get(modId)!.simulate != null;

export const sourceNets = (circ: Circuit, nets: string[]): string[] => {
  const aux = (circ: Circuit, net: string): string[] => {
    const { id, in: inp } = circ.nets.get(net)!;

    if (isPrimitiveModule(circ, id)) {
      return [net];
    }

    if (inp.length === 0) {
      return [net];
    }

    return aux(circ, inp[0]);
  };

  return nets.flatMap(net => aux(circ, net));
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

export const keepPrimitiveModules = (circ: Circuit): Circuit => {
  const newCirc: Circuit = {
    modules: new Map(),
    nets: new Map(),
    signatures: new Map(),
  };

  // only keep primitive modules
  for (const [modId, node] of circ.modules.entries()) {
    if (node.simulate != null) {
      const newPins = {
        in: mapObject(node.pins.in, conns => sourceNets(circ, conns.map(connectionToNet)).map(netToConnection)),
        out: mapObject(node.pins.out, conns => sourceNets(circ, conns.map(connectionToNet)).map(netToConnection)),
      };

      newCirc.modules.set(modId, {
        ...node,
        pins: newPins,
      });
    }
  }

  for (const [net, io] of Iter.filter(circ.nets.entries(), ([, { id }]) => isPrimitiveModule(circ, id))) {
    newCirc.nets.set(net, {
      in: sourceNets(circ, io.in),
      out: sourceNets(circ, io.out),
      id: io.id,
    });
  }

  const presentModuleNames = new Set(Iter.map(newCirc.modules.values(), m => m.name));

  for (const moduleName of presentModuleNames) {
    newCirc.signatures.set(moduleName, circ.signatures.get(moduleName)!);
  }

  return newCirc;
};