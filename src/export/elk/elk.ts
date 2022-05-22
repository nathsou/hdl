import { Circuit, IO, ModuleNode, RawConnection } from "../../core";

const generateElkFile = (circuit: Circuit): string => {
  const edges: string[] = [];
  
  const subgraph = (mod: ModuleNode) => {
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
  layout [ size: 100, ${Math.max(50, maxPinCount * 50)} ]
  nodeLabels.placement: "H_LEFT V_TOP OUTSIDE"
  portConstraints: FIXED_SIDE
  portLabels.placement: INSIDE
  label "${mod.name}:${mod.id}"
  ${ports.join('')}
}`;
  };

  const subgraphs = [...circuit.modules.values()].map(subgraph);

  return [
    'algorithm: layered',
    subgraphs.map(s => '  ' + s),
    edges.map(s => '  ' + s),
  ].join('\n');
};

export const Elk = {
  generateElkFile,
};