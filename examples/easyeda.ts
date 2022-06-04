import { EasyEDA, Schematic } from "../src/export/easyeda/parse";

const fetchPart = async (lcsc: string) => {
  const res = await fetch(`https://easyeda.com/api/products/${lcsc}/components`);
  return (await res.json())?.result;
};

const getSymbol = async (lcsc: string): Promise<string> => {
  const part = await fetchPart(lcsc);

  const symb = EasyEDA.Schematic.Symbol.moveTo({
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
    id: 'nath00',
  }, 0, 0);

  const pins = new Map(
    (symb.shapes.filter((s: Schematic['Shape']['ANY']) => s.command === 'P') as Schematic['Shape']['Pin'][])
      .map(pin => [
        pin.pinNumber,
        {
          name: pin.name.text,
          x: pin.pinDot.x,
          y: pin.pinDot.y,
        }
      ])
  );

  console.log(pins);

  return [
    EasyEDA.Schematic.Symbol.show(symb),
    ...symb.shapes.map(EasyEDA.Schematic.Shape.show),
  ].join('#@$');
};

(async () => {
  console.log(await getSymbol('C1523472'));
})();
