import { promises as fs } from "node:fs";

export async function readManifest() {
  return fs.readFile(new URL("../package.json", import.meta.url), "utf8");
}

export function greeting(name: string) {
  return `hello ${name}`;
}
