import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const bashCompletionPath = fileURLToPath(new URL("../completions/trustmcp.sh", import.meta.url));
const zshCompletionPath = fileURLToPath(new URL("../completions/trustmcp.zsh", import.meta.url));

describe("completion scripts", () => {
  it("ships bash completion for the stable CLI surface", async () => {
    const script = await readFile(bashCompletionPath, "utf8");

    expect(script).toContain("complete -F _trustmcp trustmcp");
    expect(script).toContain("scan");
    expect(script).toContain("--config");
    expect(script).toContain("--summary-only");
    expect(script).toContain("--fail-on");
    expect(script).toContain("--output-file");
    expect(script).toContain("text json markdown sarif");
    expect(script).toContain("low medium high");
  });

  it("ships zsh completion for the stable CLI surface", async () => {
    const script = await readFile(zshCompletionPath, "utf8");

    expect(script).toContain("compdef _trustmcp trustmcp");
    expect(script).toContain("scan");
    expect(script).toContain("--config");
    expect(script).toContain("--summary-only");
    expect(script).toContain("--fail-on");
    expect(script).toContain("--output-file");
    expect(script).toContain("text json markdown sarif");
    expect(script).toContain("low medium high");
  });
});
