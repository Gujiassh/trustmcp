import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import type { ScanFile } from "./types.js";

const INCLUDED_EXTENSIONS = new Set([
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".cts",
  ".mts",
  ".jsx",
  ".tsx",
  ".json"
]);

const INCLUDED_FILENAMES = new Set(["package.json"]);

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".next",
  ".turbo",
  "build",
  "test",
  "tests",
  "__tests__",
  "fixtures",
  "__fixtures__"
]);

const MAX_FILE_BYTES = 256_000;

export async function collectSourceFiles(rootDir: string): Promise<ScanFile[]> {
  const files: ScanFile[] = [];
  await walk(rootDir, rootDir, files);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function walk(rootDir: string, currentDir: string, files: ScanFile[]): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of sortedEntries) {
    const absolutePath = join(currentDir, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      await walk(rootDir, absolutePath, files);
      continue;
    }

    if (!entry.isFile() || !shouldInclude(entry.name)) {
      continue;
    }

    const fileStats = await stat(absolutePath);
    if (fileStats.size > MAX_FILE_BYTES) {
      continue;
    }

    const content = await readFile(absolutePath, "utf8");
    if (content.includes("\u0000")) {
      continue;
    }

    files.push({
      absolutePath,
      relativePath: relative(rootDir, absolutePath),
      content,
      lines: content.split(/\r?\n/)
    });
  }
}

function shouldInclude(fileName: string): boolean {
  if (INCLUDED_FILENAMES.has(fileName)) {
    return true;
  }

  return INCLUDED_EXTENSIONS.has(extname(fileName));
}
