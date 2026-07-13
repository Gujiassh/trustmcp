import { lstat, readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import type { ScanFile, SkippedSourceFile, SourceCollection } from "./types.js";

const INCLUDED_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts", ".cts", ".mts", ".jsx", ".tsx", ".json"]);
const INCLUDED_FILENAMES = new Set(["package.json"]);

export const IGNORED_SOURCE_DIRECTORIES = [
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
] as const;

const ignoredDirectorySet = new Set<string>(IGNORED_SOURCE_DIRECTORIES);
export const MAX_SOURCE_FILE_BYTES = 256_000;

export async function collectSourceFiles(rootDir: string): Promise<SourceCollection> {
  const files: ScanFile[] = [];
  const skippedFiles: SkippedSourceFile[] = [];
  await walk(rootDir, rootDir, files, skippedFiles);
  return {
    files: files.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    skippedFiles: skippedFiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  };
}

async function walk(
  rootDir: string,
  currentDir: string,
  files: ScanFile[],
  skippedFiles: SkippedSourceFile[]
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of sortedEntries) {
    const absolutePath = join(currentDir, entry.name);
    const relativePath = relative(rootDir, absolutePath);

    if (entry.isSymbolicLink()) {
      if (shouldInclude(entry.name)) {
        const fileStats = await lstat(absolutePath);
        skippedFiles.push({ relativePath, reason: "symbolic-link", sizeBytes: fileStats.size });
      }
      continue;
    }

    if (entry.isDirectory()) {
      if (!ignoredDirectorySet.has(entry.name)) {
        await walk(rootDir, absolutePath, files, skippedFiles);
      }
      continue;
    }

    if (!entry.isFile() || !shouldInclude(entry.name)) {
      continue;
    }

    const fileStats = await stat(absolutePath);
    if (fileStats.size > MAX_SOURCE_FILE_BYTES) {
      skippedFiles.push({ relativePath, reason: "file-too-large", sizeBytes: fileStats.size });
      continue;
    }

    const content = await readFile(absolutePath, "utf8");
    if (content.includes("\u0000")) {
      skippedFiles.push({ relativePath, reason: "binary-content", sizeBytes: fileStats.size });
      continue;
    }

    files.push({
      absolutePath,
      relativePath,
      content,
      lines: content.split(/\r?\n/)
    });
  }
}

function shouldInclude(fileName: string): boolean {
  return INCLUDED_FILENAMES.has(fileName) || INCLUDED_EXTENSIONS.has(extname(fileName));
}
