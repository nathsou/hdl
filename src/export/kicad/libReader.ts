
export interface KiCadLibReader {
  readSymbolLibraryFile: (symbolName: string) => Promise<string>,
  readFootprintFile: (library: string, footprintName: string) => Promise<string>,
}