import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { auditTarget } from "../src/core/audit.js";
import { collectSourceFiles, MAX_SOURCE_FILE_BYTES } from "../src/core/source-files.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("source file collection coverage", () => {
  it("collects normal files and reports relevant files excluded by bounded policy", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "normal.ts"), "export const value = 1;", "utf8");
    await writeFile(join(root, "oversized.ts"), "x".repeat(MAX_SOURCE_FILE_BYTES + 1), "utf8");
    await writeFile(join(root, "binary.js"), Buffer.from([0, 1, 2, 3]));
    await symlink("normal.ts", join(root, "linked.ts"));
    await mkdir(join(root, "tests"));
    await writeFile(join(root, "tests", "ignored.ts"), "eval('ignored');", "utf8");

    const collection = await collectSourceFiles(root);

    expect(collection.files.map((file) => file.relativePath)).toEqual(["normal.ts"]);
    expect(collection.skippedFiles).toEqual([
      { relativePath: "binary.js", reason: "binary-content", sizeBytes: 4 },
      { relativePath: "linked.ts", reason: "symbolic-link", sizeBytes: 9 },
      { relativePath: "oversized.ts", reason: "file-too-large", sizeBytes: MAX_SOURCE_FILE_BYTES + 1 }
    ]);
  });

  it("distinguishes complete no-match from incomplete no-match", async () => {
    const completeRoot = await createTempDirectory();
    await writeFile(join(completeRoot, "clean.ts"), "export const value = 1;", "utf8");
    const complete = await auditTarget(completeRoot);

    const incompleteRoot = await createTempDirectory();
    await writeFile(join(incompleteRoot, "clean.ts"), "export const value = 1;", "utf8");
    await writeFile(join(incompleteRoot, "large.ts"), `eval("hidden");${" ".repeat(MAX_SOURCE_FILE_BYTES)}`, "utf8");
    const incomplete = await auditTarget(incompleteRoot);

    expect(complete.coverage).toMatchObject({ complete: true, scannedFileCount: 1, skippedFileCount: 0 });
    expect(complete.summary.message).toContain("No matching rules were triggered.");
    expect(incomplete.coverage).toMatchObject({ complete: false, scannedFileCount: 1, skippedFileCount: 1 });
    expect(incomplete.summary.message).toContain("No matching rules were triggered in the scanned subset.");
    expect(incomplete.summary.message).toContain("Coverage incomplete");
  });
});

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "trustmcp-source-files-"));
  tempDirectories.push(directory);
  return directory;
}
