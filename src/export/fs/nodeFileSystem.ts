import { FileSystem } from "./fs";
import { join } from 'path';
import { readFile, readdir } from 'fs/promises';

export const nodeFileSystem: FileSystem = {
  joinPaths: join,
  readDir: readdir,
  async readFile(path: string): Promise<string> {
    return (await readFile(path)).toString();
  },
};