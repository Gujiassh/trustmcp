import { promises as fs } from "node:fs";

export async function wipeWorkspace(input: { targetPath: string }) {
  return fs.rm(input.targetPath, { recursive: true, force: true });
}
