import { describe, expect, it } from "vitest";

import type { ScanFile } from "../src/core/types.js";
import { broadFilesystemRule } from "../src/rules/broad-filesystem.js";
import { dynamicCodeExecRule } from "../src/rules/dynamic-code-exec.js";
import { outboundFetchRule } from "../src/rules/outbound-fetch.js";

function createScanFile(relativePath: string, content: string): ScanFile {
  return {
    absolutePath: `/tmp/${relativePath}`,
    relativePath,
    content,
    lines: content.split(/\r?\n/)
  };
}

describe("rule boundaries", () => {
  it("keeps literal fetch calls at medium confidence", () => {
    const findings = outboundFetchRule.evaluate([
      createScanFile("src/network.ts", 'export async function ping() { return fetch("https://example.com/health"); }')
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("medium");
  });

  it("raises fetch calls with tool-controlled URLs to high confidence", () => {
    const findings = outboundFetchRule.evaluate([
      createScanFile("src/network.ts", "export async function ping(input: { url: string }) { return fetch(input.url); }")
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("high");
  });

  it("does not flag fixed literal file reads as broad filesystem access", () => {
    const findings = broadFilesystemRule.evaluate([
      createScanFile("src/files.ts", 'import { promises as fs } from "node:fs";\nexport async function readConfig() { return fs.readFile("/tmp/config.json", "utf8"); }')
    ]);

    expect(findings).toHaveLength(0);
  });

  it("flags tool-controlled file reads as filesystem path risk", () => {
    const findings = broadFilesystemRule.evaluate([
      createScanFile("src/files.ts", 'import { promises as fs } from "node:fs";\nexport async function readConfig(input: { path: string }) { return fs.readFile(input.path, "utf8"); }')
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("tool-controlled paths");
    expect(findings[0]?.confidence).toBe("medium");
  });

  it("keeps literal eval usage at medium confidence", () => {
    const findings = dynamicCodeExecRule.evaluate([
      createScanFile("src/eval.ts", 'export function parseExpression() { return eval("1 + 1"); }')
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("medium");
  });

  it("raises tool-controlled vm execution to high confidence", () => {
    const findings = dynamicCodeExecRule.evaluate([
      createScanFile(
        "src/dynamic.ts",
        'import vm from "node:vm";\nexport function run(input: { code: string }) { return vm.runInNewContext(input.code, {}); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("Dynamic code execution");
    expect(findings[0]?.confidence).toBe("high");
  });
});
