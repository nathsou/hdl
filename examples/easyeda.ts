import { EasyEDA } from "../src/export/easyeda/parse";

const fetchPart = async (lcsc: string) => {
  const res = await fetch(`https://easyeda.com/api/products/${lcsc}/components`);
  return (await res.json())?.result;
};

const getSymbol = async (lcsc: string): Promise<string> => {
  const part = (await fetchPart(lcsc)).dataStr;

  const symb = EasyEDA.Schematic.Symbol.show({
    command: 'LIB',
    x: part.head.x,
    y: part.head.y,
    attributes: part.head.c_para,
    importFlag: 0,
    rotation: 0,
    shapes: [], // part.shape.map(EasyEDA.Schematic.Shape.parse) 
    id: 'nath00',
  });

  return [symb, ...part.shape].join('#@$');
};

(async () => {
  console.log(await getSymbol('C352964'));
})();
