import { ElkEdge, ElkLabel, ElkNode, ElkPort, ElkPrimitiveEdge, ElkExtendedEdge } from 'elkjs';

type Rect = {
  type: 'rect',
  x: number,
  y: number,
  width: number,
  height: number,
  borderColor: string,
  borderWidth: number,
  color: string,
};

type Text = {
  type: 'text',
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  fontFamily: string,
  fontSize: number,
  color: string,
};

type Line = {
  type: 'line',
  x1: number,
  x2: number,
  y1: number,
  y2: number,
};

type Circle = {
  type: 'circle',
  x: number,
  y: number,
  radius: number,
};

type Shape = Rect | Text | Line | Circle;

const renderSvg = (shapes: Shape[], { width, height }: { width: number, height: number }): string => {
  const rect = ({ x, y, width, height, color, borderColor, borderWidth }: Rect) => {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" style="fill: ${color}; stroke: ${borderColor}; stroke-width: ${borderWidth};" />`;
  };

  const text = ({ x, y, text, fontFamily, fontSize, color }: Text) => {
    return `<text x="${x}" y="${y}" style="font-family: ${fontFamily}; font-size: ${fontSize}; fill: ${color};">${text}</text>`;
  };

  const line = ({ x1, y1, x2, y2 }: Line) => {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" />`;
  };

  const circle = ({ x, y, radius }: Circle) => {
    return `<circle cx="${x}" cy="${y}" r="${radius}" />`;
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

  return `
<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${parts.join('\n')}
</svg>`;
};

const fontSize = 10;

export const ElkRenderer = {
  asShapeList: (rootNode: ElkNode): { shapes: Shape[], dims: { width: number, height: number } } => {
    const shapes: Shape[] = [];

    const isPrimitiveEdge = (edge: ElkEdge): edge is ElkPrimitiveEdge => {
        return (edge as ElkPrimitiveEdge).source !== undefined && (edge as ElkPrimitiveEdge).target !== undefined;
    };
  
    const isExtendedEdge = (edge: ElkEdge): edge is ElkExtendedEdge => {
      return (edge as ElkExtendedEdge).sources !== undefined && (edge as ElkExtendedEdge).targets !== undefined;
    };

    const traverseLabel = (label: ElkLabel, parentPos: { x: number, y: number }): void => {
      shapes.push({
        type: 'text',
        x: parentPos.x + label.x!,
        y: parentPos.y + label.y!,
        text: label.text,
        width: label.width!,
        height: label.height!,
        color: 'black',
        fontFamily: 'sans-serif',
        fontSize,
      });
    };

    const traversePort = (port: ElkPort, parentPos: { x: number, y: number }): void => {
      const dir = port.layoutOptions ? port.layoutOptions['port.side'] ?? 'WEST' : 'WEST';

      shapes.push({
        type: 'rect',
        x: parentPos.x + port.x! - 2.5,
        y: parentPos.y + port.y! - 2.5,
        width: 5,
        height: 5,
        color: 'white',
        borderColor: 'black',
        borderWidth: 1,
      });

      for (const label of port.labels ?? []) {
        const offsetX = dir === 'EAST' ? -label.text.length * fontSize : 5;
        traverseLabel(label, { x: parentPos.x + port.x! + offsetX, y: parentPos.y + port.y! });
      }
    };

    const traverseEdge = (edge: ElkEdge, parentPos: { x: number, y: number }): void => {
      if (isExtendedEdge(edge)) {
        edge.sections.forEach(section => {
          const prev = { x: section.startPoint.x, y: section.startPoint.y };

          for (const bendPoint of section.bendPoints ?? []) {
            shapes.push({
              type: 'line',
              x1:  parentPos.x + prev.x,
              y1:  parentPos.y + prev.y,
              x2:  parentPos.x + bendPoint.x,
              y2:  parentPos.y + bendPoint.y,
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
          });
        });

        (edge.junctionPoints ?? []).forEach(junction => {
          shapes.push({
            type: 'circle',
            x: junction.x,
            y: junction.y,
            radius: 2,
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
        borderColor: 'black',
        borderWidth: 1,
        color: 'white',
      });

      for (const child of node.children ?? []) {
        traverseNode(child, pos);
      }
      
      for (const label of node.labels ?? []) {
        traverseLabel(label, pos);
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

    return { shapes, dims: { width, height } };
  },
  renderSvg,
};