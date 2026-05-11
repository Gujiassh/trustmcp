import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const workflowPath = fileURLToPath(new URL("../.github/workflows/release.yml", import.meta.url));

describe("release workflow", () => {
  it("uses the full local release gate instead of the older publish-only check", async () => {
    const content = await readFile(workflowPath, "utf8");

    expect(content).toContain("run: npm run release:check");
    expect(content).not.toContain("run: npm run publish:check");
  });
});
