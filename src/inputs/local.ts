import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import type { MaterializedSource } from "../core/types.js";

export async function materializeLocalDirectory(input: string): Promise<MaterializedSource> {
  const resolvedPath = resolve(input);

  let fileStats: Awaited<ReturnType<typeof stat>>;
  try {
    fileStats = await stat(resolvedPath);
  } catch {
    throw new Error(`Local directory not found: ${input}`);
  }

  if (!fileStats.isDirectory()) {
    throw new Error(`Local path is not a directory: ${input}`);
  }

  return {
    rootDir: resolvedPath,
    target: {
      input,
      displayName: resolvedPath,
      sourceType: "local-directory"
    }
  };
}
