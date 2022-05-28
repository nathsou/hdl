
export interface KiCadLibReader {
  listSymbolLibs: () => Promise<string[]>,
  listFootprintLibs: () => Promise<string[]>,
  readSymbolLibraryFile: (symbolName: string) => Promise<string>,
  readFootprintFile: (library: string, footprintName: string) => Promise<string>,
}