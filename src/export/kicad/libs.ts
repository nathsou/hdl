import { readdir } from 'fs/promises';
import { join } from 'path';

export type KiCadLibraries = {
  symbols: string[],
  footprints: string[],
};

const findByExt = (files: string[], ext: string): string[] => {
  return files.filter(f => f.endsWith(ext)).map(f => f.replace(ext, ''));
};

export const scanLibraries = async (libsDir: string) => {
  const symbolsDir = join(libsDir, 'symbols');
  const footprintsDir = join(libsDir, 'footprints');

  const symbolLibs = findByExt(await readdir(symbolsDir), '.kicad_sym');
  const footprintLibs = findByExt(await readdir(footprintsDir), '.pretty');

  return {
    symbolLibs,
    footprintLibs,
  };
};