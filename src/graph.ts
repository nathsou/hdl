import { Circuit, ModuleNode, RawConnection } from "./core";
import { gen, join, joinWithEndingSep } from "./utils";

export const createGraphDotFile = (circuit: Circuit) => {
  const label = (c: RawConnection) => `"${c.pin}:${c.modId}"`;
  const edges = new Set<string>();

  const subgraph = (mod: ModuleNode) => {
    const sig = circuit.signatures.get(mod.name)!;
    const nodes = [...join(Object.entries(sig.inputs), Object.entries(sig.outputs))].flatMap(([pin, width]) => {
      if (width === 1) {
        return [`"${pin}:${mod.id}" [label="${pin}"]`];
      }

      return gen(width, n => `"${pin}${n}:${mod.id}" [label="${pin}${n}"]`);
    });

    for (const [pin, connections] of Object.entries(mod.pins.in)) {
      const start: RawConnection = { modId: mod.id, pin };
      for (const conn of connections) {
        const label1 = label(start);
        const label2 = label(conn);
        if (label1 !== label2) {
          edges.add(`${label2} -> ${label1}`);
        }
      }
    }

    for (const [pin, connections] of Object.entries(mod.pins.out)) {
      const start: RawConnection = { modId: mod.id, pin };
      for (const conn of connections) {
        const label1 = label(start);
        const label2 = label(conn);
        if (label1 !== label2) {
          edges.add(`${label1} -> ${label2}`);
        }
      }
    }

    return `subgraph cluster_${mod.id} {\n` +
      '    label=' + `"${mod.name}:${mod.id}";\n` +
      joinWithEndingSep([...nodes].map(node => '    ' + node), ';\n') +
      '  }\n';
  };

  const subgraphs = [...circuit.modules.values()].map(subgraph);

  return 'digraph circuit {\n' +
    '  overlap=scale;\n' +
    '  compound=true;\n\n' +
    joinWithEndingSep(subgraphs.map(s => '  ' + s), '\n') +
    joinWithEndingSep([...edges].map(edge => '  ' + edge), ';\n') +
    '}\n';
};