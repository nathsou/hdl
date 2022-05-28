import { KiCadLibReader } from "./libReader";
import { readFile, access } from 'fs/promises';
import { join } from 'path';

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const readFileWithExistenceCheck = async (path: string): Promise<string> => {
  if (!(await exists(path))) {
    throw new Error(`File '${path} does not exist'`);
  }

  return (await readFile(path, 'utf-8')).toString();
};

export const createNodeKicadLibReader = (paths: { symbolsDir: string, footprintsDir: string }): KiCadLibReader => ({
  async readSymbolLibraryFile(symbolName: string) {
    const path = join(paths.symbolsDir, `${symbolName}.kicad_sym`);
    return await readFileWithExistenceCheck(path);
  },
  async readFootprintFile(library: string, footprintName: string): Promise<string> {
    const path = join(paths.footprintsDir, `${library}.pretty`, `${footprintName}.kicad_mod`);
    return await readFileWithExistenceCheck(path);
  },
});