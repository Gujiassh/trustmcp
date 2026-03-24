import { promises as fs } from "node:fs";

export async function listTree(input: { path: string }) {
  return fs.readdir(input.path, { recursive: true });
}
