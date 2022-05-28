import { KiCadLibReader } from "./libReader";
import fetch, { Response } from 'node-fetch';
import { createCache } from "../../utils";

const projectIds = {
  symbols: 21545491, // https://gitlab.com/kicad/libraries/kicad-symbols
  footprints: 21601606, // https://gitlab.com/kicad/libraries/kicad-footprints
};

const logFetch = async (log: boolean, uri: string): Promise<Response> => {
  const t1 = Date.now();

  if (log) {
    console.log(`fetching ${uri}`);
  }

  const res = await fetch(uri);

  if (log) {
    console.log(`took ${Date.now() - t1}ms`);
  }

  return res;
};

export const createGitlabKiCadLibReader = ({ logRequests }: { logRequests: boolean }): KiCadLibReader => {
  const fileCache = createCache<string, string>();

  const readFileContents = async (projectId: number, path: string, log: boolean): Promise<string> => {
    const uri = `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(path)}?ref=master`;

    return fileCache.keyAsync(uri, async () => {
      const res = await logFetch(log, uri);

      if (res.status === 404) {
        throw new Error(`File not found in GitLab repository ${projectId}: '${path}'`);
      }

      const contents = Buffer.from((await res.json() as any).content, 'base64').toString();
      return contents;
    });
  };

  return {
    async readSymbolLibraryFile(symbolName: string) {
      return await readFileContents(projectIds.symbols, `${symbolName}.kicad_sym`, logRequests);
    },
    async readFootprintFile(library: string, footprintName: string) {
      return await readFileContents(projectIds.footprints, `${library}.pretty/${footprintName}.kicad_mod`, logRequests);
    },
  };
};