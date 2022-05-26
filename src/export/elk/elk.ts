import { ELK, ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api';
import { Circuit, IO, ModuleNode, RawConnection } from "../../core";
import { ElkRenderer, RendererStyle } from './renderer';

const generateElkJson = (circuit: Circuit): ElkNode => {
  const edges: ElkExtendedEdge[] = [];

  const subNode = (mod: ModuleNode): ElkNode => {
    const sig = circuit.signatures.get(mod.name)!;
    const ports: ElkPort[] = [];
    const inputPorts = IO.linearizePinout(sig.inputs);
    const outputPorts = IO.linearizePinout(sig.outputs);
    let longestPinLabelLength = 0;

    [
      { pins: inputPorts, isInput: true },
      { pins: outputPorts, isInput: false }
    ].forEach(({ pins, isInput }) => {
      pins.forEach(pin => {
        ports.push({
          id: `${pin}:${mod.id}`,
          labels: [{
            id: `${pin}_${mod.id}_label`,
            text: pin,
          }],
          layoutOptions: {
            'port.side': isInput ? 'WEST' : 'EAST',
          },
        });

        if (pin.length > longestPinLabelLength) {
          longestPinLabelLength = pin.length;
        }
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
            sources: [`${from.pin}:${from.modId}`],
            targets: [`${to.pin}:${to.modId}`],
            sections: [],
          });
        }
      }
    });

    return {
      id: `n${mod.id}`,
      width: Math.max(10 * longestPinLabelLength * 2 + 10, 50),
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
  generateJSON: generateElkJson,
  async layout(elkInstance: ELK, circuit: Circuit): Promise<ElkNode> {
    return await elkInstance.layout(generateElkJson(circuit));
  },
  async renderSvg(elkInstance: ELK, circuit: Circuit, style?: RendererStyle): Promise<string> {
    const layout = await Elk.layout(elkInstance, circuit);
    const { shapes, dims } = ElkRenderer.asShapeList(layout);
    return ElkRenderer.renderSvg(shapes, dims, style);
  },
  async renderCanvas(elkInstance: ELK, circuit: Circuit, ctx: CanvasRenderingContext2D, style?: RendererStyle): Promise<void> {
    const layout = await Elk.layout(elkInstance, circuit);
    const { shapes, dims } = ElkRenderer.asShapeList(layout);
    ElkRenderer.renderCanvas(shapes, dims, ctx, style);
  },
};