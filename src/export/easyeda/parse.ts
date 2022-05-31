
// https://docs.easyeda.com/en/DocumentFormat/2-EasyEDA-Schematic-File-Format/index.html

const DOC_TYPE = {
  SCH: 1,
  SCHLIB: 2,
  PCB: 3,
  PCBLIB: 4,
  PRJ: 5,
  SUBPART: 6,
  SPICESYMBOL: 7,
  SUBCKT: 8,
  WAVEFORM: 10,
};

const STROKE_STYLE = {
  solid: 0,
  dashed: 1,
  dotted: 2,
} as const;

const REVERSE_STROKE_STYLE: Record<string, StrokeStyle> = {
  0: 'solid',
  1: 'dashed',
  2: 'dotted',
};

type StrokeStyle = keyof typeof STROKE_STYLE;

type Rotation = null | number;

type TextAnchor = 'start' | 'middle' | 'end';

type Schematic = {
  Canvas: {
    command: 'CA',
    viewboxWidth: number,
    viewboxHeight: number,
    background: string,
    isGridVisible: boolean,
    gridColor: string,
    gridSize: number,
    canvasWidth: number,
    canvasHeight: number,
    gridStyle: 'line' | 'dot',
    snapSize: number,
    unit: 'pixel',
    altSnapSize: number,
    originX: number,
    originY: number,
  },
  Symbol: {
    command: 'LIB',
    x: number,
    y: number,
    attributes: Record<string, string>,
    rotation: Rotation,
    importFlag: any,
    id: string,
    shapes: Shape[],
  },
  Shape: {
    ANY: Schematic['Shape']['Polyline' | 'Rectangle' | 'Text' | 'Pin'],
    Rectangle: {
      command: 'R',
      x: number,
      y: number,
      rx: number,
      ry: number,
      width: number,
      height: number,
      strokeColor: string,
      strokeWidth: number,
      strokeStyle: StrokeStyle,
      fillColor: string,
      id: string,
    },
    Polyline: {
      command: 'PL',
      points: { x: number, y: number }[],
      strokeColor: string,
      strokeWidth: number,
      strokeStyle: StrokeStyle,
      fillColor: string,
      id: string,
    },
    Text: {
      command: 'T',
      mark: 'L' | 'N' | 'P', // label, name, prefix
      x: number,
      y: number,
      rotation: Rotation,
      fillColor: string,
      fontFamily: null | string,
      fontSize: string,
      fontWeight: string,
      fontStyle: string,
      dominantBaseline: any,
      textType: 'comment' | 'spice',
      text: string,
      visible: boolean,
      textAnchor: TextAnchor,
      id: string,
    },
    Pin: {
      command: 'P',
      display: string,
      electric: any,
      pinNumber: number,
      x: number,
      y: number,
      rotation: Rotation,
      id: string,
      pinDot: { x: number, y: number },
      pinPath: {
        path: string,
        color: string,
      },
      name: {
        visible: boolean,
        x: number,
        y: number,
        rotation: Rotation,
        text: string,
        textAnchor: TextAnchor,
        fontFamily: null | string,
        fontSize: string,
      },
      number: {
        visible: boolean,
        x: number,
        y: number,
        rotation: Rotation,
        text: string,
        textAnchor: TextAnchor,
        fontFamily: null | string,
        fontSize: string,
      },
      dot: {
        visible: boolean,
        x: number,
        y: number,
      },
      clock: {
        visible: boolean,
        path: string,
      },
    },
  },
};

type Shape = Schematic['Shape']['ANY'];

const joinProps = (props: (string | number | null)[]) => props.map(p => p === null ? '' : p).join('~');

const Schematic = {
  Canvas: {
    command: 'CA',
    show(cnv: Schematic['Canvas']): string {
      return joinProps([
        Schematic.Canvas.command,
        cnv.viewboxWidth,
        cnv.viewboxHeight,
        cnv.background,
        cnv.isGridVisible ? 'yes' : 'none',
        cnv.gridColor,
        cnv.gridSize,
        cnv.canvasWidth,
        cnv.canvasHeight,
        cnv.gridStyle,
        cnv.snapSize,
        cnv.unit,
        cnv.altSnapSize,
        cnv.originX,
        cnv.originY,
      ]);
    },
    parse(str: string): Schematic['Canvas'] {
      const [
        _CA,
        viewboxWidth,
        viewboxHeight,
        background,
        isGridVisible,
        gridColor,
        gridSize,
        canvasWidth,
        canvasHeight,
        gridStyle,
        snapSize,
        _unit,
        altSnapSize,
        originX,
        originY,
      ] = str.split('~');

      return {
        command: 'CA',
        viewboxWidth: Number(viewboxWidth),
        viewboxHeight: Number(viewboxHeight),
        background,
        isGridVisible: isGridVisible === 'yes',
        gridColor,
        gridSize: Number(gridSize),
        canvasWidth: Number(canvasWidth),
        canvasHeight: Number(canvasHeight),
        gridStyle: gridStyle as 'line' | 'dot',
        snapSize: Number(snapSize),
        unit: 'pixel',
        altSnapSize: Number(altSnapSize),
        originX: Number(originX),
        originY: Number(originY),
      };
    },
  },
  Symbol: {
    command: 'LIB',
    show(s: Schematic['Symbol']): string {
      return [
        Schematic.Symbol.command,
        s.x,
        s.y,
        Object.entries(s.attributes).map(([attr, value]) => attr + '`' + value + '`').join(''),
        s.rotation,
        s.shapes.map(Schematic.Shape.show).join('#@$'),
      ].join('~');
    },
    parse(str: string): Schematic['Symbol'] {
      const [config, ...shapes] = str.split('#@$');

      const [
        _LIB, x, y, attributes, rotation,
        importFlag, id,
      ] = config.split('~');

      const parseAttributes = (attrs: string) => {
        const entries = attrs.split('`').filter(prop => prop.length > 0);
        const result: Record<string, string> = {};

        for (let i = 0; i < entries.length; i += 2) {
          result[entries[i]] = entries[i + 1];
        }

        return result;
      }

      return {
        command: 'LIB',
        x: Number(x),
        y: Number(y),
        attributes: parseAttributes(attributes),
        rotation: rotation === null ? null : Number(rotation),
        importFlag,
        id,
        shapes: shapes.map(Schematic.Shape.parse),
      };
    },
  },
  Shape: {
    show(shape: Shape): string {
      const mapping: Record<Shape['command'], (shape: any) => string> = {
        R: Schematic.Shape.Rectangle.show,
        PL: Schematic.Shape.Polyline.show,
        T: Schematic.Shape.Text.show,
        P: Schematic.Shape.Pin.show,
      };

      return mapping[shape.command](shape);
    },
    parse(str: string): Shape {
      const mapping: Record<Shape['command'], (str: string) => Shape> = {
        R: Schematic.Shape.Rectangle.parse,
        PL: Schematic.Shape.Polyline.parse,
        T: Schematic.Shape.Text.parse,
        P: Schematic.Shape.Pin.parse,
      };

      const commands = [
        Schematic.Shape.Rectangle.command,
        Schematic.Shape.Polyline.command,
        Schematic.Shape.Text.command,
        Schematic.Shape.Pin.command,
      ];

      const command = str.split('~')[0];

      if (!commands.includes(command)) {
        throw new Error(`Unrecognized command: ${command}, in ${str}`);
      }

      return mapping[command as Shape['command']](str);
    },
    Rectangle: {
      command: 'R',
      show(r: Schematic['Shape']['Rectangle']): string {
        return joinProps([
          Schematic.Shape.Rectangle.command,
          r.x,
          r.y,
          r.rx,
          r.ry,
          r.width,
          r.height,
          r.strokeColor,
          r.strokeWidth,
          STROKE_STYLE[r.strokeStyle],
          r.fillColor,
          r.id,
        ]);
      },
      parse(str: string): Schematic['Shape']['Rectangle'] {
        const [
          _R, x, y, rx, ry, width, height, strokeColor,
          strokeWidth, strokeStyle, fillColor, id,
        ] = str.split('~');

        return {
          command: 'R',
          x: Number(x),
          y: Number(y),
          rx: Number(rx),
          ry: Number(ry),
          width: Number(width),
          height: Number(height),
          strokeColor,
          strokeWidth: Number(strokeWidth),
          strokeStyle: REVERSE_STROKE_STYLE[strokeStyle],
          fillColor,
          id,
        };
      },
    },
    Polyline: {
      command: 'PL',
      show(p: Schematic['Shape']['Polyline']): string {
        return joinProps([
          Schematic.Shape.Polyline.command,
          p.points.flatMap(({ x, y }) => [x, y]).join(' '),
          p.strokeColor,
          p.strokeWidth,
          STROKE_STYLE[p.strokeStyle],
          p.fillColor,
          p.id,
        ]);
      },
      parse(str: string): Schematic['Shape']['Polyline'] {
        const [
          _PL, points, strokeColor, strokeWidth,
          strokeStyle, fillColor, id,
        ] = str.split('~');

        const parsePoints = (points: string) => {
          const pts = points.split(' ').map(Number);
          const result: { x: number, y: number }[] = [];

          for (let i = 0; i < pts.length; i += 2) {
            result.push({ x: pts[i], y: pts[i + 1] });
          }

          return result;
        };

        return {
          command: 'PL',
          points: parsePoints(points),
          strokeColor,
          strokeWidth: Number(strokeWidth),
          strokeStyle: REVERSE_STROKE_STYLE[strokeStyle],
          fillColor,
          id,
        };
      },
    },
    Text: {
      command: 'T',
      show(t: Schematic['Shape']['Text']): string {
        return joinProps([
          Schematic.Shape.Text.command,
          t.mark,
          t.x,
          t.y,
          t.rotation,
          t.fillColor,
          t.fontFamily,
          t.fontSize,
          t.fontWeight,
          t.fontStyle,
          t.dominantBaseline,
          t.textType,
          t.text,
          t.visible ? 1 : 0,
          t.textAnchor,
          t.id,
        ]);
      },
      parse(str: string): Schematic['Shape']['Text'] {
        const [
          _T, mark, x, y, rotation, fillColor, fontFamily, fontSize, fontWeight,
          fontStyle, dominantBaseline, textType, text, visible, textAnchor, id,
        ] = str.split('~');

        return {
          command: 'T',
          mark: mark as 'L' | 'N' | 'P',
          x: Number(x),
          y: Number(y),
          rotation: rotation === '' ? null : Number(rotation),
          fillColor,
          fontFamily,
          fontSize,
          fontWeight,
          fontStyle,
          dominantBaseline,
          textType: textType as 'comment' | 'spice',
          text,
          visible: visible === '1',
          textAnchor: textAnchor as TextAnchor,
          id,
        };
      },
    },
    Pin: {
      command: 'P',
      show(p: Schematic['Shape']['Pin']): string {
        return [
          joinProps([
            Schematic.Shape.Pin.command,
            p.display,
            p.electric,
            p.pinNumber,
            p.x,
            p.y,
            p.rotation,
            p.id,
          ]),
          joinProps([
            p.pinDot.x,
            p.pinDot.y,
          ]),
          joinProps([
            p.pinPath.path,
            p.pinPath.color,
          ]),
          joinProps([
            p.name.visible ? 1 : 0,
            p.name.x,
            p.name.y,
            p.name.rotation,
            p.name.text,
            p.name.textAnchor,
            p.name.fontFamily,
            p.name.fontSize,
          ]),
          joinProps([
            p.number.visible ? 1 : 0,
            p.number.x,
            p.number.y,
            p.number.rotation,
            p.number.text,
            p.number.textAnchor,
            p.number.fontFamily,
            p.number.fontSize,
          ]),
          joinProps([
            p.dot.visible ? 1 : 0,
            p.dot.x,
            p.dot.y,
          ]),
          joinProps([
            p.clock.visible ? 1 : 0,
            p.clock.path,
          ]),
        ].join('^^');
      },
      parse(str: string): Schematic['Shape']['Pin'] {
        const [
          config, pinDot, pinPath,
          name, number, dot, clock,
        ] = str.split('^^');

        const [
          display, electric, pinNumber,
          x, y, rotation, id,
        ] = config.split('~');

        const [pinDotX, pinDotY] = pinDot.split('~');
        const [pinPathPath, pinPathColor] = pinPath.split('~');
        const [
          nameVisible, nameX, nameY, nameRotation,
          nameText, nameTextAnchor, nameFontFamily,
          nameFontSize,
        ] = name.split('~');

        const [
          numberVisible, numberX, numberY, numberRotation,
          numberText, numberTextAnchor, numberFontFamily,
          numberFontSize,
        ] = number.split('~');

        const [dotVisible, dotX, dotY] = dot.split('~');
        const [clockVisible, clockPath] = clock.split('~');

        return {
          command: 'P',
          display,
          electric,
          pinNumber: Number(pinNumber),
          x: Number(x),
          y: Number(y),
          rotation: rotation === '' ? null : Number(rotation),
          id,
          pinDot: {
            x: Number(pinDotX),
            y: Number(pinDotY),
          },
          pinPath: {
            path: pinPathPath,
            color: pinPathColor,
          },
          name: {
            visible: nameVisible === '1',
            x: Number(nameX),
            y: Number(nameY),
            rotation: nameRotation === '' ? null : Number(nameRotation),
            text: nameText,
            textAnchor: nameTextAnchor as TextAnchor,
            fontFamily: nameFontFamily,
            fontSize: nameFontSize,
          },
          number: {
            visible: numberVisible === '1',
            x: Number(numberX),
            y: Number(numberY),
            rotation: numberRotation === '' ? null : Number(numberRotation),
            text: numberText,
            textAnchor: numberTextAnchor as TextAnchor,
            fontFamily: numberFontFamily,
            fontSize: numberFontSize,
          },
          dot: {
            visible: dotVisible === '1',
            x: Number(dotX),
            y: Number(dotY),
          },
          clock: {
            visible: clockVisible === '1',
            path: clockPath,
          },
        };
      },
    },
  },
};

export const EasyEDA = {
  Schematic,
};