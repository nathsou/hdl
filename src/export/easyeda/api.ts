import { Schematic } from "./parse";

export type LCSCPartNumber = `C${number}`;

export const fetchPart = async (lcsc: LCSCPartNumber) => {
  const res = await fetch(`https://easyeda.com/api/products/${lcsc}/components`);
  return (await res.json())?.result;
};

export type LCSCPartData = any;

export const getSymbol = (part: LCSCPartData, designator: string): Schematic['Symbol'] => {
  return EasyEDA.Schematic.Symbol.moveTo({
    command: 'LIB',
    x: part.dataStr.head.x,
    y: part.dataStr.head.y,
    attributes: part.dataStr.head.c_para,
    importFlag: 0,
    rotation: 0,
    packageUuid: part.dataStr.head.puuid,
    datastrid: part.datastrid,
    updateTime: part.updateTime,
    packageDetailDatastrid: part.packageDetail.datastrid,
    shapes: part.dataStr.shape.map(EasyEDA.Schematic.Shape.parse),
    designator,
    id: 'nath00',
  }, 0, 0);
};

export const getSymbolString = (part: LCSCPartData, designator: string): string => {
  const symb = getSymbol(part, designator);

  return [
    EasyEDA.Schematic.Symbol.show(symb),
    ...symb.shapes.map(EasyEDA.Schematic.Shape.show),
  ].join('#@$');
};

export const generateModuleDef = async (lcsc: LCSCPartNumber): Promise<string> => {
  const part = await fetchPart(lcsc);

  const rawShapes: string[] = part.dataStr.shape;
  const shapes = rawShapes.map(EasyEDA.Schematic.Shape.parse);

  const pinBaseName = (name: string) => {
    if (/^\d+$/.test(name)) {
      return '*';
    }

    if (/\d+$/.test(name)) {
      return name.split(/\d+$/)[0].toLowerCase();
    }

    if (/^\d+/.test(name)) {
      return name.split(/^\d+/)[1].toLowerCase();
    }

    return name.toLowerCase();
  };

  const pins = new Map(
    (shapes.filter((s: Schematic['Shape']['ANY']) => s.command === 'P') as Schematic['Shape']['Pin'][])
      .map(pin => [
        pin.pinNumber,
        {
          name: pin.name.text.toLowerCase(),
          baseName: pinBaseName(pin.name.text),
          x: pin.pinDot.x,
          y: pin.pinDot.y,
        }
      ])
  );

  const baseNames = [...pins.values()].map(p => p.baseName);
  const baseNamesWidth = [...new Set(baseNames)].map(baseName => [
    baseName,
    baseNames.reduce((count, name) => (name === baseName) ? count + 1 : count, 0)
  ] as const);

  const moduleDef = `
/**
 * name: ${part.dataStr.head.c_para.name}
 * package: ${part.dataStr.head.c_para.package}${part.description ? `\ndescription: ${part.description}\n` : ''}
 */
const ${lcsc} = defineModule({
  name: '${lcsc}',
  // pins: { ${baseNamesWidth.map(([name, width]) => `${/[a-zA-Z_]/.test(name[0]) ? name : `'${name}'`}: ${width}`).join(', ')} },
  inputs: {},
  outputs: {},
  lcsc: '${lcsc}',
  simulate() {
    throw new Error('Missing simulation for auto-generated module definition of ${lcsc}');
  }
});
  `.trim();

  return moduleDef;
};

export const EasyEDA = {
  Schematic,
  api: {
    fetchPart,
    async generateModuleDefs(parts: LCSCPartNumber[]): Promise<string> {
      const defs = await Promise.all(parts.map(generateModuleDef));
      return defs.join('\n\n');
    },
  },
};