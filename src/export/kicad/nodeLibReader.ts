import { KiCadLibReader } from "./libReader";
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

const findByExt = (files: string[], ext: string): string[] => {
  return files.filter(f => f.endsWith(ext)).map(f => f.replace(ext, ''));
};

export const createNodeKicadLibReader = (paths: { symbolsDir: string, footprintsDir: string }): KiCadLibReader => ({
  async listSymbolLibs() {
    return findByExt(await readdir(paths.symbolsDir), '.kicad_sym');
  },
  async listFootprintLibs() {
    return findByExt(await readdir(paths.footprintsDir), '.pretty');
  },
  async readSymbolLibraryFile(symbolName: string) {
    const path = join(paths.symbolsDir, `${symbolName}.kicad_sym`);
    return (await readFile(path, 'utf-8')).toString();
  },
  async readFootprintFile(library: string, footprintName: string): Promise<string> {
    return (await readFile(join(paths.footprintsDir, `${library}.pretty`, `${footprintName}.kicad_mod`))).toString();
  },
});