import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { parseSymbolLibrary, SExpr, SymbolDef } from './parse';

export type KiCadLibraries = {
  symbols: Set<string>,
  footprints: Set<string>,
  querySymbol: (lib: string, part: string) => Promise<SymbolDef>,
  queryFootprint: (lib: string, part: string) => Promise<void>,
};

const findByExt = (files: string[], ext: string): string[] => {
  return files.filter(f => f.endsWith(ext)).map(f => f.replace(ext, ''));
};

export const scanLibraries = async (libsDir: string): Promise<KiCadLibraries> => {
  const symbolsDir = join(libsDir, 'symbols');
  const footprintsDir = join(libsDir, 'footprints');
  const symbolLibs = new Set(findByExt(await readdir(symbolsDir), '.kicad_sym'));
  const footprintLibs = new Set(findByExt(await readdir(footprintsDir), '.pretty'));
  const symbolsCache = new Map<string, Map<string, SymbolDef>>();
  const footprintsCache = new Map<string, Set<string>>();

  return {
    symbols: symbolLibs,
    footprints: footprintLibs,
    async querySymbol(lib, part): Promise<SymbolDef> {
      if (!symbolLibs.has(lib)) {
        throw new Error(`Symbol library '${lib}.kicad_sym' not found`);
      }

      if (!symbolsCache.has(lib)) {
        const libFile = join(symbolsDir, `${lib}.kicad_sym`);
        const contents = (await readFile(libFile)).toString();
        const libParts = parseSymbolLibrary(contents);
        symbolsCache.set(lib, libParts);
      }

      const libParts = symbolsCache.get(lib)!;

      if (libParts.has(part)) {
        return libParts.get(part)!;
      } else {
        throw new Error(`Symbol '${part}' not found in symbol library '${lib}', available symbols:\n${[...libParts.keys()].join(', ')}`);
      }
    },
    async queryFootprint(lib, part): Promise<void> {
      if (!footprintLibs.has(lib)) {
        throw new Error(`Footprint library '${lib}.pretty' not found`);
      }

      if (!footprintsCache.has(lib)) {
        const libDir = join(footprintsDir, `${lib}.pretty`);
        const parts = new Set(findByExt(await readdir(libDir), '.kicad_mod'));
        footprintsCache.set(lib, parts);
      }

      const parts = footprintsCache.get(lib)!;

      if (!parts.has(part)) {
        throw new Error(`Footprint '${part}' not found in footprint library '${lib}', available footprints:\n${[...parts].join(', ')}`);
      }
    },
  };
};