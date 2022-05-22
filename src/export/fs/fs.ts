
export interface FileSystem {
  joinPaths: (...paths: string[]) => string,
  readDir: (path: string) => Promise<string[]>,
  readFile: (path: string) => Promise<string>,
}