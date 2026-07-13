import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { isMainModule } from "../src/cli/main.js";

describe("CLI main-module detection", () => {
  it("accepts direct and symbolic-link invocation paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "trustmcp-main-module-"));

    try {
      const entrypoint = join(root, "main.js");
      const linkedEntrypoint = join(root, "trustmcp");
      await writeFile(entrypoint, "", "utf8");
      await symlink(entrypoint, linkedEntrypoint);

      const canonicalEntrypoint = await realpath(entrypoint);
      const moduleUrl = pathToFileURL(canonicalEntrypoint).href;

      expect(isMainModule(moduleUrl, entrypoint)).toBe(true);
      expect(isMainModule(moduleUrl, linkedEntrypoint)).toBe(true);
      expect(isMainModule(moduleUrl, join(root, "missing"))).toBe(false);
      expect(isMainModule(moduleUrl, undefined)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
