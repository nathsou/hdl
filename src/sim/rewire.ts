import { Circuit, ModuleId, ModuleNode, Net, RawConnection } from "../core";
import { Iter, mapObject } from "../utils";

const sourceNets = (circ: Circuit, nets: string[], keep: (node: ModuleNode) => boolean): string[] => {
  const aux = (circ: Circuit, net: string): string[] => {
    const { id, in: inp } = circ.nets.get(net)!;
    const node = circ.modules.get(id)!;

    if (keep(node)) {
      return [net];
    }

    if (inp.length === 0) {
      return [];
    }

    return aux(circ, inp[0]);
  };

  return nets.flatMap(net => aux(circ, net));
};

const targetNets = (circ: Circuit, nets: string[], keep: (node: ModuleNode) => boolean): string[] => {
  const aux = (circ: Circuit, net: string): string[] => {
    const { id, out } = circ.nets.get(net)!;
    const node = circ.modules.get(id)!;

    if (keep(node)) {
      return [net];
    }

    if (out.length === 0) {
      return [];
    }

    return aux(circ, out[0]);
  };

  return nets.flatMap(net => aux(circ, net));
};

const filterOutputs = (circuit: Circuit, nets: string[], keep: (node: ModuleNode) => boolean): ModuleId[] => {
  const aux = (circ: Circuit, net: string): ModuleId[] => {
    const { id, out } = circ.nets.get(net)!;
    const node = circ.modules.get(id)!;

    if (keep(node)) {
      return [id];
    }

    return filterOutputs(circ, out, keep);
  };

  return nets.flatMap(net => aux(circuit, net));
};

export const netToConnection = (net: string): RawConnection => {
  const [pin, modId] = net.split(':');
  return { pin, modId: Number(modId) };
};

export const connectionToNet = (c: RawConnection): Net => {
  return `${c.pin}:${c.modId}`;
};

/**
 * keeps the modules for which the keep predicate returns true and forwards the connections
 * of the removed modules
 */
const keepModules = (circ: Circuit, keep: (node: ModuleNode) => boolean): Circuit => {
  const newCirc: Circuit = {
    modules: new Map(),
    nets: new Map(),
    signatures: new Map(),
  };

  for (const [modId, node] of circ.modules) {
    if (keep(node)) {
      const newPins = {
        in: mapObject(node.pins.in, conns => sourceNets(circ, conns.map(connectionToNet), keep).map(netToConnection)),
        out: mapObject(node.pins.out, conns => sourceNets(circ, conns.map(connectionToNet), keep).map(netToConnection)),
      };

      newCirc.modules.set(modId, {
        ...node,
        pins: newPins,
      });
    }
  }

  for (const [net, io] of Iter.filter(circ.nets, ([, { id }]) => keep(circ.modules.get(id)!))) {
    newCirc.nets.set(net, {
      in: sourceNets(circ, io.in, keep),
      out: targetNets(circ, io.out, keep),
      id: io.id,
    });
  }

  const presentModuleNames = new Set(Iter.map(newCirc.modules.values(), m => m.name));

  for (const moduleName of presentModuleNames) {
    newCirc.signatures.set(moduleName, circ.signatures.get(moduleName)!);
  }

  return newCirc;
};

const keepPrimitiveModules = (circ: Circuit): Circuit => {
  return keepModules(circ, node => node.simulate != null);
};

const keepKiCadModules = (circ: Circuit): Circuit => {
  return keepModules(circ, node => circ.signatures.get(node.name)!.kicad != null);
};

const keepLCSCModules = (circ: Circuit): Circuit => {
  return keepModules(circ, node => circ.signatures.get(node.name)!.lcsc != null);
};

export const Rewire = {
  keepModules,
  keepPrimitiveModules,
  keepKiCadModules,
  keepLCSCModules,
  filterOutputs,
};