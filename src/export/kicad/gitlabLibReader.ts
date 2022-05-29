import { KiCadLibReader } from "./libReader";
import { createCache } from "../../utils";

type ResponseLike = {
  status: number,
  json: () => Promise<any>,
};

type FetchFnLike = (uri: string) => Promise<ResponseLike>;

const logFetch = async (log: boolean, uri: string, fetchImpl: FetchFnLike | undefined): Promise<ResponseLike> => {
  if (typeof fetchImpl === 'undefined') {
    throw new Error(`Fetch API not found, you can provide a custom implementation to 'createGitLabKiCadLibReader'`);
  }

  const t1 = Date.now();

  if (log) {
    console.log(`fetching ${uri}`);
  }

  const res = await fetchImpl(uri);

  if (log) {
    console.log(`took ${Date.now() - t1}ms`);
  }

  return res;
};

export type GitLabKicadLibReaderOptions = {
  logRequests?: boolean,
  fetch?: FetchFnLike | undefined, // custom fetch impl (node-fetch on node for instance)
  projectIds?: {
    symbols: number
    footprints: number,
  },
};

export const createGitLabKiCadLibReader = ({
  logRequests = false,
  fetch: fetchImpl = 'fetch' in globalThis ? fetch : undefined,
  projectIds = {
    symbols: 21545491, // https://gitlab.com/kicad/libraries/kicad-symbols
    footprints: 21601606, // https://gitlab.com/kicad/libraries/kicad-footprints
  },
}: GitLabKicadLibReaderOptions): KiCadLibReader => {
  const fileCache = createCache<string, string>();

  const readFileContents = async (projectId: number, path: string, log: boolean): Promise<string> => {
    const uri = `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(path)}?ref=master`;

    return fileCache.keyAsync(uri, async () => {
      const res = await logFetch(log, uri, fetchImpl);

      if (res.status === 404) {
        throw new Error(`File not found in GitLab repository ${projectId}: '${path}'`);
      }

      return atob((await res.json() as any).content);
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