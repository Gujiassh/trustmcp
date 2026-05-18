import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const exampleFiles = [
  ".github/examples/trustmcp-artifact.yml",
  ".github/examples/trustmcp-baseline-gate.yml",
  ".github/examples/trustmcp-gate.yml",
  ".github/examples/trustmcp-json-artifact.yml",
  ".github/examples/trustmcp-pr-comment.yml",
  ".github/examples/trustmcp-public-target.yml",
  ".github/examples/trustmcp-sarif-artifact.yml",
  ".github/examples/trustmcp-upload-sarif.yml"
];

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

describe("action examples", () => {
  it("do not pin the outdated v0.1.0 action tag", async () => {
    for (const relativePath of exampleFiles) {
      const absolutePath = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
      const content = await readFile(absolutePath, "utf8");

      expect(content, relativePath).not.toContain("Gujiassh/trustmcp@v0.1.0");
    }
  });

  it("keep example paths rooted in the repository examples directory", () => {
    expect(exampleFiles.every((path) => path.startsWith(".github/examples/"))).toBe(true);
    expect(repoRoot.length).toBeGreaterThan(0);
  });
});
