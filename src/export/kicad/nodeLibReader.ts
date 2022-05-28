import { join } from 'path';
import { KiCadLibReader } from "./libReader";

const exists = async (path: string): Promise<boolean> => {
  const { access } = await import('fs/promises');

  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const readFileWithExistenceCheck = async (path: string): Promise<string> => {
  const { readFile } = await import('fs/promises');

  if (!(await exists(path))) {
    throw new Error(`File '${path} does not exist'`);
  }

  return (await readFile(path, 'utf-8')).toString();
};

export const createFileSystemKicadLibReader = (paths: { symbolsDir: string, footprintsDir: string }): KiCadLibReader => ({
  async readSymbolLibraryFile(symbolName: string) {
    const path = join(paths.symbolsDir, `${symbolName}.kicad_sym`);
    return await readFileWithExistenceCheck(path);
  },
  async readFootprintFile(library: string, footprintName: string): Promise<string> {
    const path = join(paths.footprintsDir, `${library}.pretty`, `${footprintName}.kicad_mod`);
    return await readFileWithExistenceCheck(path);
  },
});