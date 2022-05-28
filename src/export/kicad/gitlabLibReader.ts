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

const listAllRepositoryFiles = async (id: number, log: boolean): Promise<string[]> => {
  const allFiles: string[] = [];

  const aux = async (nextRequest: string) => {
    const res = await logFetch(log, nextRequest);

    // retrieve the uri for the next page
    const links = new Map(res.headers.get('link')?.split(',').map(entry => {
      const [link, rel] = entry.split(';');
      return [
        rel.trim().replace('rel=', '').replaceAll('"', ''),
        link.replaceAll(/[<>]/g, '')
      ];
    }) ?? []);

    const files = await res.json() as { path: string }[];
    allFiles.push(...files.map(f => f.path));

    if (links.has('next')) {
      await aux(links.get('next')!);
    }
  };

  await aux(`https://gitlab.com/api/v4/projects/${id}/repository/tree?per_page=100&pagination=keyset`);

  return allFiles;
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
    async listSymbolLibs() {
      const files = await listAllRepositoryFiles(projectIds.symbols, logRequests);
      return files
        .filter((name: string) => name.endsWith('.kicad_sym'))
        .map((name: string) => name.replace('.kicad_sym', ''));
    },
    async listFootprintLibs() {
      const files = await listAllRepositoryFiles(projectIds.footprints, logRequests);
      return files
        .filter((name: string) => name.endsWith('.pretty'))
        .map((name: string) => name.replace('.pretty', ''));
    },
    async readSymbolLibraryFile(symbolName: string) {
      return await readFileContents(projectIds.symbols, `${symbolName}.kicad_sym`, logRequests);
    },
    async readFootprintFile(library: string, footprintName: string) {
      return await readFileContents(projectIds.footprints, `${library}.pretty/${footprintName}.kicad_mod`, logRequests);
    },
  };
};