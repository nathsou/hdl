import { and, Circuit, createCache, defineModule, isolateGates, Iter, metadata, ModuleId, Net, pinHeaders1x4, pinMapping, reversePinMapping, Rewire } from "../src";
import { EasyEDA, fetchPart, getSymbol, LCSCPartNumber } from "../src/export/easyeda/api";
import { Schematic } from "../src/export/easyeda/parse";
import { writeFile } from 'fs/promises';

/**
 * name: 74HC08D,653
 * package: SOIC-14_L8.7-W3.9-P1.27-LS6.0-BL
 */
const C5593 = defineModule({
  name: 'C5593',
  inputs: { a: 4, b: 4, gnd: 1, vcc: 1 },
  outputs: { y: 4 },
  lcsc: { partNumber: 'C5593' },
  simulate() {
    throw new Error('auto-generated module definition for C5593');
  }
});

const top = defineModule({
  name: 'top',
  inputs: {},
  outputs: {},
  connect() {
    const a = pinHeaders1x4();
    const b = pinHeaders1x4();
    const y = pinHeaders1x4();

    const [and1, and2, and3, and4] = isolateGates(C5593());

    y.out.pins = [
      and4(a.out.pins[3], b.out.pins[3]),
      and3(a.out.pins[2], b.out.pins[2]),
      and2(a.out.pins[1], b.out.pins[1]),
      and1(a.out.pins[0], b.out.pins[0]),
    ];
  },
})();

const generateSchematic = async (circuit: Circuit) => {
  const partCache = createCache<LCSCPartNumber, any>();

  const symbols = new Map<ModuleId, Schematic['Symbol']>();
  const pins = createCache<ModuleId, Map<string, { pinNumber: number, x: number, y: number }>>();

  const MAX_WIDTH = 2000; // px
  const MARGIN_X = 20; // px
  const MARGIN_Y = 20; // px

  let totalWidth = 0;
  let maxHeight = 0;

  const currentPos = { x: 0, y: 0 }; // top left

  for (const [id, node] of circuit.modules) {
    const sig = circuit.signatures.get(node.name)!;

    if (sig.lcsc == null) {
      throw new Error(`Unspecified LCSC part number for module '${node.name}'`);
    }

    const data = await partCache.keyAsync(sig.lcsc!.partNumber, () => fetchPart(sig.lcsc!.partNumber));
    const symbol = getSymbol(data, data.dataStr.head.c_para.pre.replace('?', id))

    const width = data.dataStr.BBox.width;
    const height = data.dataStr.BBox.height;

    totalWidth += width;
    maxHeight = Math.max(maxHeight, height);

    symbols.set(id, EasyEDA.Schematic.Symbol.moveTo(
      symbol,
      currentPos.x + width / 2,
      currentPos.y + height / 2,
    ));

    currentPos.x += width + MARGIN_X;
  }

  const nets: string[] = [];

  const getNetPosition = (net: Net) => {
    const [pin, modId] = Net.decompose(net);
    const node = circuit.modules.get(modId)!;
    const sig = circuit.signatures.get(node.name)!;
    const mapping = pins.key(modId, () => {
      const symb = symbols.get(modId);

      if (symb == null) {
        throw new Error(`Unspecified LCSC part number for module ${modId}`);
      }

      const pinShapes = symb.shapes.filter(s => s.command === 'P') as Schematic['Shape']['Pin'][];

      const defaultPinMapping = Object.fromEntries(
        pinShapes.map(pin => [pin.pinNumber, pin.name.text])
      );

      const nameMap = pinMapping(
        node.name, { ...sig.inputs, ...sig.outputs },
        sig.lcsc?.pins ?? defaultPinMapping,
      );

      return new Map(pinShapes.map(pin => [
        nameMap[pin.pinNumber],
        {
          pinNumber: pin.pinNumber,
          x: pin.pinDot.x,
          y: pin.pinDot.y,
        }]));
    });

    if (!mapping.has(pin)) {
      throw new Error(`Could not get position of pin '${pin}' in module ${modId}`);
    }

    return mapping.get(pin)!;
  };

  for (const [net, { out }] of circuit.nets) {
    for (const targetNet of [net, ...out]) {
      const { x, y } = getNetPosition(targetNet);
      nets.push(`F~part_netLabel_netPort~${x}~${y}~180~${net}_${targetNet}F~~0^^${x}~${y}^^${net}~#235789~${x + 10}~${y}~0~~1~Times New Roman~5pt~${net}_${targetNet}NL^^R~${x - 2}~${y - 2}~~~4~4~#235789~1~0~none~${net}_${targetNet}R~0~`);
    }
  }

  return {
    "editorVersion": "6.5.5",
    "docType": "5",
    "title": "Test",
    "description": "",
    "colors": {},
    "schematics": [
      {
        "docType": "1",
        "title": "Sheet_1",
        "description": "",
        "dataStr": {
          "head": {
            "docType": "1",
            "editorVersion": "6.5.5",
            "newgId": true,
            "c_para": {
              "Prefix Start": "1"
            },
            "c_spiceCmd": "null",
            "hasIdFlag": true,
            "uuid": "ab9e97cb51514c1c9ebdf63b8cb4d94e",
            "x": "0",
            "y": "0",
            "portOfADImportHack": "",
            "importFlag": 0,
            "transformList": ""
          },
          "canvas": "CA~1000~1000~#FFFFFF~yes~#CCCCCC~5~1000~1000~line~5~pixel~5~0~0",
          "shape": [...Iter.map(symbols.values(), EasyEDA.Schematic.Symbol.show), ...nets],
          "BBox": {
            "x": 0,
            "y": 0,
            "width": totalWidth,
            "height": maxHeight,
          },
          "colors": {}
        }
      }
    ]
  };
};

(async () => {
  const { circuit } = metadata(top);
  const lcscCircuit = Rewire.keepLCSCModules(circuit);

  const sch = await generateSchematic(lcscCircuit);

  await writeFile('./out/sch.json', JSON.stringify(sch, null, 2));

  // console.log(await EasyEDA.api.generateModuleDefs(['C358684']));
})();
