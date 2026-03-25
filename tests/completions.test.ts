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
    expect(script).toContain("doctor");
    expect(script).toContain("init-config");
    expect(script).toContain("list-rules");
    expect(script).toContain("version");
    expect(script).toContain("--config");
    expect(script).toContain("--version");
    expect(script).toContain("-v");
    expect(script).toContain("tsv json");
    expect(script).toContain("--summary-only");
    expect(script).toContain("--fail-on");
    expect(script).toContain("--output-file");
    expect(script).toContain("text json markdown sarif");
    expect(script).toContain("low medium high");
    expect(script).toContain("--json --format --config");
    expect(script).toContain("text json");
  });

  it("ships zsh completion for the stable CLI surface", async () => {
    const script = await readFile(zshCompletionPath, "utf8");

    expect(script).toContain("compdef _trustmcp trustmcp");
    expect(script).toContain("scan");
    expect(script).toContain("doctor");
    expect(script).toContain("init-config");
    expect(script).toContain("list-rules");
    expect(script).toContain("version");
    expect(script).toContain("--config");
    expect(script).toContain("--version");
    expect(script).toContain("-v");
    expect(script).toContain("tsv json");
    expect(script).toContain("--summary-only");
    expect(script).toContain("--fail-on");
    expect(script).toContain("--output-file");
    expect(script).toContain("text json markdown sarif");
    expect(script).toContain("low medium high");
    expect(script).toContain("--config --json --format");
    expect(script).toContain("text json");
  });
});
