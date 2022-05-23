import ELK, { ElkNode, ElkPort, ElkExtendedEdge } from 'elkjs';
import { Circuit, IO, metadata, Module, ModuleNode, RawConnection } from "../../core";
import { ElkRenderer } from './renderer';
 
const generateElkFile = (circuit: Circuit): string => {
  const edges: string[] = [];

  const subgraph = (mod: ModuleNode): string => {
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
  label "${mod.name}_${mod.id}"
  ${ports.join('')}
  }`;
  };

  const subgraphs = [...circuit.modules.values()].map(subgraph);

  return [
    'algorithm: layered',
    ...subgraphs.map(s => '  ' + s),
    ...edges.map(s => '  ' + s),
  ].join('\n');
};

const generateElkJson = (circuit: Circuit): ElkNode => {
  const edges: ElkExtendedEdge[] = [];

  const subNode = (mod: ModuleNode): ElkNode => {
    const sig = circuit.signatures.get(mod.name)!;
    const ports: ElkPort[] = [];
    const inputPorts = IO.linearizePinout(sig.inputs);
    const outputPorts = IO.linearizePinout(sig.outputs);
  
    [
      { pins: inputPorts, isInput: true },
      { pins: outputPorts, isInput: false }
    ].forEach(({ pins, isInput }) => {
      pins.forEach(pin => {
        ports.push({
          id: `${pin}_${mod.id}`,
          labels: [{
            id: `${pin}_${mod.id}_label`,
            text: pin,
          }],
          layoutOptions: {
            'port.side': isInput ? 'WEST' : 'EAST',
          },
        });
      });
    });
  
    const maxPinCount = Math.max(inputPorts.length, outputPorts.length);
  
    [
      { pins: mod.pins.in, isOutput: false },
      { pins: mod.pins.out, isOutput: true }
    ].forEach(({ pins, isOutput }) => {
      for (const [pin, connections] of Object.entries(pins)) {
        const start: RawConnection = { modId: mod.id, pin };
        for (const conn of connections) {
          const [from, to] = isOutput ? [start, conn] : [conn, start];
          edges.push({
            id: `e${edges.length}`,
            sources: [`${from.pin}_${from.modId}`],
            targets: [`${to.pin}_${to.modId}`],
            sections: [],
          });
        }
      }
    });

    return {
      id: `n${mod.id}`,
      width: 100,
      height: Math.max(50, maxPinCount * 20),
      labels: [{ id: `n${mod.id}_label`, text: `${mod.name}_${mod.id}` }],
      ports,
      edges: [],
      children: [],
      layoutOptions: {
        'nodeLabels.placement': '[H_LEFT, V_TOP, OUTSIDE]',
        'spacing.portPort': '10',
        'portConstraints': 'FIXED_SIDE',
        'portLabels.placement': '[INSIDE]',
      },
    };
  };

  const subNodes = [...circuit.modules.values()].map(subNode);

  return {
    id: 'root',
    children: subNodes,
    edges,
    ports: [],
    layoutOptions: {
      algorithm: 'layered',
    },
  };
};

export const Elk = {
  generateElkFile,
  generateElkJson,
  async layout(circuit: Circuit): Promise<ElkNode> {
    const elk = new ELK();
    return await elk.layout(generateElkJson(circuit));
  },
  async renderSvg(circuit: Circuit): Promise<string> {
    const layout = await Elk.layout(circuit);
    const { shapes, dims } = ElkRenderer.asShapeList(layout);
    return ElkRenderer.renderSvg(shapes, dims);
  },
};