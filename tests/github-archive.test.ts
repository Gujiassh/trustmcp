import { access, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";

import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";

import {
  materializeGitHubArchiveBuffer,
  validateGitHubArchiveEntries,
  type GitHubArchiveEntryMetadata,
  type GitHubArchiveLimits
} from "../src/inputs/github.js";

const SMALL_LIMITS: GitHubArchiveLimits = {
  maxEntryCount: 4,
  maxEntryBytes: 16,
  maxTotalBytes: 24
};

describe("GitHub archive materialization limits", () => {
  it("extracts a normal GitHub-shaped archive", async () => {
    const archive = new AdmZip();
    archive.addFile("repo-sha/src/index.ts", Buffer.from("export {};"));

    const materialized = await materializeGitHubArchiveBuffer(archive.toBuffer(), SMALL_LIMITS);
    try {
      await expect(access(`${materialized.rootDir}/src/index.ts`)).resolves.toBeUndefined();
    } finally {
      await materialized.cleanup();
    }
    await expect(access(materialized.rootDir)).rejects.toThrow();
  });

  it("rejects too many entries before extraction", async () => {
    const archive = new AdmZip();
    archive.addFile("repo/a.ts", Buffer.from("a"));
    archive.addFile("repo/b.ts", Buffer.from("b"));
    await expect(materializeGitHubArchiveBuffer(archive.toBuffer(), { ...SMALL_LIMITS, maxEntryCount: 1 }))
      .rejects.toThrow("entry count 2 exceeds limit 1");
  });

  it("rejects excessive per-entry and total uncompressed sizes", async () => {
    const archive = new AdmZip();
    archive.addFile("repo/a.ts", Buffer.alloc(12));
    archive.addFile("repo/b.ts", Buffer.alloc(12));

    await expect(materializeGitHubArchiveBuffer(archive.toBuffer(), { ...SMALL_LIMITS, maxEntryBytes: 8 }))
      .rejects.toThrow("per-entry limit 8 bytes");
    await expect(materializeGitHubArchiveBuffer(archive.toBuffer(), { ...SMALL_LIMITS, maxTotalBytes: 20 }))
      .rejects.toThrow("total uncompressed size 24 bytes exceeds limit 20 bytes");
  });

  it.each(["../escape.ts", "repo/../../escape.ts", "/absolute.ts", "C:/escape.ts", "repo\\..\\escape.ts"])(
    "rejects unsafe archive destination %s",
    (entryName) => {
      const entry: GitHubArchiveEntryMetadata = {
        entryName,
        isDirectory: false,
        header: { size: 1 }
      };
      expect(() => validateGitHubArchiveEntries([entry], "/tmp/trustmcp-test", SMALL_LIMITS))
        .toThrow("archive entry path");
    }
  );

  it("cleans temporary directories after validation and archive parsing failures", async () => {
    const before = await trustMcpTempDirectories();
    const archive = new AdmZip();
    archive.addFile("repo/large.ts", Buffer.alloc(20));

    await expect(materializeGitHubArchiveBuffer(archive.toBuffer(), SMALL_LIMITS)).rejects.toThrow("per-entry limit");
    await expect(materializeGitHubArchiveBuffer(Buffer.from("not a zip"), SMALL_LIMITS)).rejects.toThrow();

    expect(await trustMcpTempDirectories()).toEqual(before);
  });
});

async function trustMcpTempDirectories(): Promise<string[]> {
  return (await readdir(tmpdir())).filter((entry) => entry.startsWith("trustmcp-")).sort();
}
