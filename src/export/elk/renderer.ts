import type { ElkEdge, ElkLabel, ElkNode, ElkPort, ElkPrimitiveEdge, ElkExtendedEdge } from 'elkjs';

type Rect = {
  type: 'rect',
  x: number,
  y: number,
  width: number,
  height: number,
  kind: 'port' | 'module',
};

type Text = {
  type: 'text',
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  kind: 'portLabel' | 'moduleLabel'
};

type Line = {
  type: 'line',
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  kind: 'wire',
  sourceNet: string,
  targetNet: string,
};

type Circle = {
  type: 'circle',
  x: number,
  y: number,
  radius: number,
  kind: 'junction'
};

type Shape = Rect | Text | Line | Circle;

type FillStrokeStyle = {
  fill: string,
  stroke: string,
  strokeWidth: number,
};

type TextStyle = FillStrokeStyle & {
  fontFamily: string,
  fontSize: number,
};

const kebabize = (str: string) => str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? '-' : '') + $.toLowerCase());

const isTextStyle = (style: FillStrokeStyle): style is TextStyle => {
  return (style as TextStyle).fontFamily !== undefined && (style as TextStyle).fontSize !== undefined;
};

export type RendererStyle = {
  circuit: { backgroundColor: string },
  module: FillStrokeStyle,
  port: FillStrokeStyle,
  wire: FillStrokeStyle,
  junction: FillStrokeStyle,
  moduleLabel: TextStyle,
  portLabel: TextStyle,
};

const formatStyle = (style: Record<string, string | number>): string => {
  return Object
    .entries(style)
    .map(([prop, value]) => `${kebabize(prop)}: ${typeof value === 'number' ? `${value}px` : value};`)
    .join(' ');
};

const defaultStyle: RendererStyle = {
  circuit: { backgroundColor: 'white' },
  module: { fill: 'white', stroke: 'black', strokeWidth: 2 },
  port: { fill: 'white', stroke: 'black', strokeWidth: 1 },
  wire: { fill: 'none', stroke: 'black', strokeWidth: 1 },
  junction: { fill: 'black', stroke: 'none', strokeWidth: 0 },
  moduleLabel: { fontFamily: 'sans-serif', fontSize: 10, fill: 'black', strokeWidth: 1, stroke: 'none' },
  portLabel: { fontFamily: 'sans-serif', fontSize: 10, fill: 'black', strokeWidth: 1, stroke: 'none' },
};

const renderSvg = (shapes: Shape[], { width, height }: { width: number, height: number }, style = defaultStyle): string => {
  const rect = ({ x, y, width, height, kind }: Rect) => {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" class="${kind}" />`;
  };

  const text = ({ x, y, text, kind }: Text) => {
    return `<text x="${x}" y="${y}" class="${kind}">${text}</text>`;
  };

  const line = ({ x1, y1, x2, y2, kind, sourceNet, targetNet }: Line) => {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${kind} source-net-${sourceNet} target-net-${targetNet}" />`;
  };

  const circle = ({ x, y, radius, kind }: Circle) => {
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="white" class="${kind}" />`;
  };

  const parts: string[] = [];

  for (const shape of shapes) {
    switch (shape.type) {
      case 'rect':
        parts.push(rect(shape));
        break;
      case 'text':
        parts.push(text(shape));
        break;
      case 'line':
        parts.push(line(shape));
        break;
      case 'circle':
        parts.push(circle(shape));
        break;
    }
  }

  return [
    `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="circuit">`,
    '  <style type="text/css">',
    Object.entries(style).map(([className, style]) => `    .${className} { ${formatStyle(style)} }`).join('\n'),
    '  </style>',
    ...parts.map(s => `  ${s}`),
    '</svg>'
  ].join('\n');
};

const renderCanvas = (
  shapes: Shape[],
  { width, height }: { width: number, height: number },
  ctx: CanvasRenderingContext2D,
  style = defaultStyle
): void => {
  ctx.clearRect(0, 0, width, height);

  for (const shape of shapes) {
    const st = style[shape.kind];

    ctx.fillStyle = st.fill;
    ctx.strokeStyle = st.stroke;
    ctx.lineWidth = st.strokeWidth;

    if (isTextStyle(st)) {
      ctx.font = `${st.fontFamily}, ${st.fontSize}px`;
    }

    switch (shape.type) {
      case 'rect':
        ctx.beginPath();
        ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        ctx.closePath();
        ctx.fill();
        break;
      case 'text':
        ctx.beginPath();
        ctx.fillText(shape.text, shape.x, shape.y);
        ctx.closePath();
        ctx.fill();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.closePath();
        ctx.stroke();
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }
};

export const ElkRenderer = {
  asShapeList: (rootNode: ElkNode, style = defaultStyle): { shapes: Shape[], dims: { width: number, height: number } } => {
    const shapes: Shape[] = [];

    const isPrimitiveEdge = (edge: ElkEdge): edge is ElkPrimitiveEdge => {
      return (edge as ElkPrimitiveEdge).source !== undefined && (edge as ElkPrimitiveEdge).target !== undefined;
    };

    const isExtendedEdge = (edge: ElkEdge): edge is ElkExtendedEdge => {
      return (edge as ElkExtendedEdge).sources !== undefined && (edge as ElkExtendedEdge).targets !== undefined;
    };

    const traverseLabel = (label: ElkLabel, parentPos: { x: number, y: number }, kind: Text['kind']): void => {
      shapes.push({
        type: 'text',
        x: parentPos.x + label.x!,
        y: parentPos.y + label.y!,
        text: label.text,
        width: label.width!,
        height: label.height!,
        kind,
      });
    };

    const traversePort = (port: ElkPort, parentPos: { x: number, y: number }): void => {
      const dir = port.layoutOptions ? port.layoutOptions['port.side'] ?? 'WEST' : 'WEST';
      const side = 5; // px 

      shapes.push({
        type: 'rect',
        x: parentPos.x + port.x! - side / 2,
        y: parentPos.y + port.y! - side / 2,
        width: side,
        height: side,
        kind: 'port',
      });

      for (const label of port.labels ?? []) {
        const offsetX = dir === 'EAST' ? -label.text.length * style.portLabel.fontSize : 5;
        traverseLabel(label, { x: parentPos.x + port.x! + offsetX, y: parentPos.y + port.y! }, 'portLabel');
      }
    };

    const traverseEdge = (edge: ElkEdge, parentPos: { x: number, y: number }): void => {
      if (isExtendedEdge(edge)) {
        const sourceNet = edge.sources[0].split(':').join('_');
        const targetNet = edge.targets[0].split(':').join('_');

        edge.sections.forEach(section => {
          const prev = { x: section.startPoint.x, y: section.startPoint.y };

          for (const bendPoint of section.bendPoints ?? []) {
            shapes.push({
              type: 'line',
              x1: parentPos.x + prev.x,
              y1: parentPos.y + prev.y,
              x2: parentPos.x + bendPoint.x,
              y2: parentPos.y + bendPoint.y,
              kind: 'wire',
              sourceNet,
              targetNet,
            });

            prev.x = bendPoint.x;
            prev.y = bendPoint.y;
          }

          shapes.push({
            type: 'line',
            x1: parentPos.x + prev.x,
            y1: parentPos.y + prev.y,
            x2: parentPos.x + section.endPoint.x,
            y2: parentPos.y + section.endPoint.y,
            kind: 'wire',
            sourceNet,
            targetNet,
          });
        });

        (edge.junctionPoints ?? []).forEach(junction => {
          shapes.push({
            type: 'circle',
            x: junction.x,
            y: junction.y,
            radius: 2,
            kind: 'junction',
          });
        });

      } else if (isPrimitiveEdge(edge)) {
        throw new Error(`primitve edges not handled yet`);
      }
    };

    const traverseNode = (node: ElkNode, parentPos: { x: number, y: number }): void => {
      const pos = { x: parentPos.x + node.x!, y: parentPos.y + node.y! };

      shapes.push({
        type: 'rect',
        x: pos.x,
        y: pos.y,
        width: node.width!,
        height: node.height!,
        kind: 'module',
      });

      for (const child of node.children ?? []) {
        traverseNode(child, pos);
      }

      for (const label of node.labels ?? []) {
        traverseLabel(label, pos, 'moduleLabel');
      }

      for (const edge of node.edges ?? []) {
        traverseEdge(edge, pos);
      }

      for (const port of node.ports ?? []) {
        traversePort(port, pos);
      }
    };

    const width = rootNode.width!;
    const height = rootNode.height!;

    traverseNode(rootNode, { x: 0, y: 0 });

    return { shapes: shapes, dims: { width, height } };
  },
  renderSvg,
  renderCanvas,
};