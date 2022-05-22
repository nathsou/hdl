import { Circuit, IO, Connection, Module, ModuleNode, Net, RawConnection, ModuleId } from "../../core";
import { Iter, joinWithEndingSep } from "../../utils";

type ElkOptions = {
  showHierarchy: boolean,
};

const hierarchy = (circuit: Circuit): string => {
  const netPaths = new Map<Net, string>();
  const edges: [Net, Net][] = [];
  const visitedModules = new Set<ModuleId>();

  const aux = (node: ModuleNode, path: string[]): string => {
    if (visitedModules.has(node.id)) {
      return '';
    }

    visitedModules.add(node.id);
    const label = (c: RawConnection) => `${c.pin}:${c.modId}`;
    const sig = circuit.signatures.get(node.name)!;
    const ports: string[] = [];
    const inputPorts = IO.linearizePinout(sig.inputs);
    const outputPorts = IO.linearizePinout(sig.outputs);

    const nodeName = `n${node.id}`;
    const newPath = [...path, nodeName];
    
    for (const pin of inputPorts) {
      netPaths.set(`${pin}:${node.id}`, `${joinWithEndingSep(newPath, '.')}${pin}`);
      ports.push(`
  port ${pin} {
    ^port.side: WEST
    label "${pin}"
  }`
      );
    }
  
    for (const pin of outputPorts) {
      netPaths.set(`${pin}:${node.id}`, `${joinWithEndingSep(newPath, '.')}${pin}`);
      ports.push(`
  port ${pin} {
    ^port.side: EAST
    label "${pin}"
  }`
      );
    }
  
    for (const [pin, connections] of Object.entries(node.pins.in)) {
      const start: RawConnection = { modId: node.id, pin };
      for (const conn of connections) {
        const net1 = label(start);
        const net2 = label(conn);
        if (net1 !== net2) {
          edges.push([net2, net1]);
        }
      }
    }
  
    for (const [pin, connections] of Object.entries(node.pins.out)) {
      const start: RawConnection = { modId: node.id, pin };
      for (const conn of connections) {
        const net1 = label(start);
        const net2 = label(conn);
        if (start !== conn) {
          edges.push([net1, net2]);
        }
      }
    }

    const maxPinCount = Math.max(inputPorts.length, outputPorts.length);
  
    return [
      `node ${nodeName} {`,
      `layout [ size: 100, ${Math.max(50, maxPinCount * 20)} ]`,
      'nodeLabels.placement: "H_LEFT V_TOP OUTSIDE"',
      'portConstraints: FIXED_SIDE',
      'portLabels.placement: INSIDE',
      `label "${node.name}:${node.id}"`,
      `${ports.join('')}`,
      `${node.subModules.filter(m => !visitedModules.has(m.id)).map(s => aux(s, newPath)).join('\n')}`,
      '}'
    ].join('\n');
  };

  return [
    'algorithm: layered',
    ...Iter.filter(Iter.map(circuit.modules.values(), node => aux(node, [])), s => s !== ''),
    edges.map(([start, end]) => `edge ${netPaths.get(start)} -> ${netPaths.get(end)}`).join('\n'),
  ].join('\n');
};

const subgraph = (mod: ModuleNode, edges: string[], circuit: Circuit): string => {
  const label = (c: RawConnection) => `n${c.modId}.${c.pin}`;
  const sig = circuit.signatures.get(mod.name)!;
  const ports: string[] = [];
  const inputPorts = IO.linearizePinout(sig.inputs);
  const outputPorts = IO.linearizePinout(sig.outputs);

  for (const pin of inputPorts) {
    ports.push(`
port ${pin} {
  ^port.side: WEST
  label "${pin}"
}`
    );
  }

  for (const pin of outputPorts) {
    ports.push(`
port ${pin} {
  ^port.side: EAST
  label "${pin}"
}`
    );
  }

  const maxPinCount = Math.max(inputPorts.length, outputPorts.length);

  for (const [pin, connections] of Object.entries(mod.pins.in)) {
    const start: RawConnection = { modId: mod.id, pin };
    for (const conn of connections) {
      const label1 = label(start);
      const label2 = label(conn);
      if (label1 !== label2) {
        edges.push(`edge ${label2} -> ${label1}`);
      }
    }
  }

  for (const [pin, connections] of Object.entries(mod.pins.out)) {
    const start: RawConnection = { modId: mod.id, pin };
    for (const conn of connections) {
      const label1 = label(start);
      const label2 = label(conn);
      if (label1 !== label2) {
        edges.push(`edge ${label1} -> ${label2}`);
      }
    }
  }

  return `
node n${mod.id} {
layout [ size: 100, ${Math.max(50, maxPinCount * 20)} ]
nodeLabels.placement: "H_LEFT V_TOP OUTSIDE"
portConstraints: FIXED_SIDE
portLabels.placement: INSIDE
label "${mod.name}:${mod.id}"
${ports.join('')}
}`;
};

const generateElkFile = (circuit: Circuit): string => {
  const edges: string[] = [];
  const subgraphs = [...circuit.modules.values()].map(n => subgraph(n, edges, circuit));

  return [
    'algorithm: layered',
    ...subgraphs.map(s => '  ' + s),
    ...edges.map(s => '  ' + s),
  ].join('\n');
};

export const Elk = {
  generateElkFile,
  generateHierarchy: hierarchy,
};