import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { AuditReport, Severity } from "../src/core/types.js";
import { parseArguments, runCli } from "../src/cli/main.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("parseArguments", () => {
  it("parses --fail-on with a separate severity argument", () => {
    expect(parseArguments(["./fixtures/local-risky", "--fail-on", "medium"])).toEqual({
      target: "./fixtures/local-risky",
      failOn: "medium"
    });
  });

  it("parses --fail-on=value alongside scan and format", () => {
    expect(parseArguments(["scan", "./fixtures/local-risky", "--format", "json", "--fail-on=high"])).toEqual({
      target: "./fixtures/local-risky",
      format: "json",
      failOn: "high"
    });
  });

  it("parses markdown output format", () => {
    expect(parseArguments(["gh:modelcontextprotocol/servers", "--format", "markdown"])).toEqual({
      target: "gh:modelcontextprotocol/servers",
      format: "markdown"
    });
  });

  it("parses --output-file in both supported forms", () => {
    expect(parseArguments(["./fixtures/local-risky", "--output-file", "report.md"])).toEqual({
      target: "./fixtures/local-risky",
      outputFile: "report.md"
    });
    expect(parseArguments(["./fixtures/local-risky", "--output-file=report.json", "--format", "json"])).toEqual({
      target: "./fixtures/local-risky",
      format: "json",
      outputFile: "report.json"
    });
  });

  it("parses --config in both supported forms", () => {
    expect(parseArguments(["./fixtures/local-risky", "--config", "trustmcp.config.json"])).toEqual({
      target: "./fixtures/local-risky",
      configFile: "trustmcp.config.json"
    });
    expect(parseArguments(["./fixtures/local-risky", "--config=trustmcp.config.json", "--format", "json"])).toEqual({
      target: "./fixtures/local-risky",
      configFile: "trustmcp.config.json",
      format: "json"
    });
  });

  it("parses --summary-only as a boolean flag", () => {
    expect(parseArguments(["gh:modelcontextprotocol/servers", "--summary-only", "--format", "markdown"])).toEqual({
      target: "gh:modelcontextprotocol/servers",
      format: "markdown",
      summaryOnly: true
    });
  });

  it("rejects invalid format values", () => {
    expect(() => parseArguments(["./fixtures/local-risky", "--format", "html"]))
      .toThrowError("--format expects one of: text, json, markdown.");
  });

  it("rejects missing --config values", () => {
    expect(() => parseArguments(["./fixtures/local-risky", "--config"]))
      .toThrowError("--config expects a file path.");
    expect(() => parseArguments(["./fixtures/local-risky", "--config", "--format", "json"]))
      .toThrowError("--config expects a file path.");
  });

  it("rejects missing --output-file values", () => {
    expect(() => parseArguments(["./fixtures/local-risky", "--output-file"]))
      .toThrowError("--output-file expects a file path.");
    expect(() => parseArguments(["./fixtures/local-risky", "--output-file", "--format", "json"]))
      .toThrowError("--output-file expects a file path.");
  });

  it("rejects invalid --fail-on values", () => {
    expect(() => parseArguments(["./fixtures/local-risky", "--fail-on", "critical"]))
      .toThrowError("--fail-on expects one of: low, medium, high.");
  });

  it("rejects missing --fail-on values", () => {
    expect(() => parseArguments(["./fixtures/local-risky", "--fail-on"]))
      .toThrowError("--fail-on expects one of: low, medium, high.");
  });
});

describe("runCli exit thresholds", () => {
  it("keeps current exit behavior when --fail-on is omitted", async () => {
    const stdout: string[] = [];
    const exitCode = await runCli(["./fixtures/local-risky"], {
      auditTarget: async () => createReport("local-directory", ["high"]),
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("Shell execution capability detected");
  });

  it("returns exit code 2 when a local finding meets the threshold", async () => {
    const exitCode = await runCli(["./fixtures/local-risky", "--fail-on", "high"], {
      auditTarget: async () => createReport("local-directory", ["high", "medium"]),
      stdout: createWriter([])
    });

    expect(exitCode).toBe(2);
  });

  it("returns exit code 2 when a GitHub finding meets the threshold", async () => {
    const exitCode = await runCli([
      "https://github.com/example/risky-mcp",
      "--format",
      "json",
      "--fail-on",
      "medium"
    ], {
      auditTarget: async () => createReport("public-github-repo", ["medium"]),
      stdout: createWriter([])
    });

    expect(exitCode).toBe(2);
  });

  it("returns exit code 0 when findings stay below the threshold", async () => {
    const exitCode = await runCli(["./fixtures/local-risky", "--fail-on", "high"], {
      auditTarget: async () => createReport("local-directory", ["medium", "low"]),
      stdout: createWriter([])
    });

    expect(exitCode).toBe(0);
  });

  it("writes the rendered report to an explicit file path while preserving stdout", async () => {
    const outputFile = await createTempFilePath("trustmcp-report.md");
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--format",
      "markdown",
      "--output-file",
      outputFile
    ], {
      auditTarget: async () => createReport("local-directory", ["high", "medium"]),
      stdout: createWriter(stdout)
    });

    const fileContent = await readFile(outputFile, "utf8");

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("# TrustMCP Report");
    expect(fileContent).toContain("# TrustMCP Report");
    expect(fileContent).toContain("Shell execution capability detected");
  });

  it("emits only the compact text summary while preserving fail-on behavior", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--summary-only",
      "--fail-on",
      "high"
    ], {
      auditTarget: async () => createReport("local-directory", ["high", "medium"]),
      stdout: createWriter(stdout)
    });

    const output = stdout.join("");
    expect(exitCode).toBe(2);
    expect(output).toContain("Summary: 2 finding(s) across 2 rule(s). Static heuristics only.");
    expect(output).not.toContain("Rule:");
    expect(output).not.toContain("Shell execution capability detected");
  });

  it("emits compact json summary-only output for a no-findings report", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-clean",
      "--summary-only",
      "--format",
      "json"
    ], {
      auditTarget: async () => createReport("local-directory", []),
      stdout: createWriter(stdout)
    });

    const parsed = JSON.parse(stdout.join("")) as {
      summary: { findingCount: number; message: string };
      findings?: unknown;
    };

    expect(exitCode).toBe(0);
    expect(parsed.summary.findingCount).toBe(0);
    expect(parsed.summary.message).toContain("No matching rules were triggered.");
    expect("findings" in parsed).toBe(false);
  });

  it("applies supported defaults from a config file", async () => {
    const reportPath = await createTempFilePath("report-from-config.md");
    const configFile = await createConfigFile(
      JSON.stringify({
        format: "markdown",
        "fail-on": "medium",
        "summary-only": true,
        "output-file": reportPath
      })
    );
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--config",
      configFile
    ], {
      auditTarget: async () => createReport("local-directory", ["medium"]),
      stdout: createWriter(stdout)
    });

    const fileContent = await readFile(reportPath, "utf8");
    expect(exitCode).toBe(2);
    expect(stdout.join("")).toContain("# TrustMCP Summary");
    expect(fileContent).toContain("# TrustMCP Summary");
    expect(fileContent).not.toContain("## Findings");
  });

  it("fails clearly on invalid config values", async () => {
    const configFile = await createConfigFile(JSON.stringify({ format: "html" }));
    const stderr: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--config",
      configFile
    ], {
      auditTarget: async () => createReport("local-directory", ["high"]),
      stdout: createWriter([]),
      stderr: createWriter(stderr)
    });

    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain("has invalid 'format'. Expected one of: text, json, markdown.");
  });

  it("lets CLI flags override config values predictably", async () => {
    const configOutputFile = await createTempFilePath("report-from-config.json");
    const cliOutputFile = await createTempFilePath("report-from-cli.md");
    const configFile = await createConfigFile(
      JSON.stringify({
        format: "json",
        "fail-on": "low",
        "summary-only": true,
        "output-file": configOutputFile
      })
    );
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--config",
      configFile,
      "--format",
      "markdown",
      "--fail-on",
      "high",
      "--output-file",
      cliOutputFile
    ], {
      auditTarget: async () => createReport("local-directory", ["medium"]),
      stdout: createWriter(stdout)
    });

    const cliFileContent = await readFile(cliOutputFile, "utf8");
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("# TrustMCP Summary");
    expect(cliFileContent).toContain("# TrustMCP Summary");
    expect(cliFileContent).not.toContain('"tool"');
    await expect(readFile(configOutputFile, "utf8")).rejects.toThrow();
  });
});

function createReport(sourceType: "local-directory" | "public-github-repo", severities: Severity[]): AuditReport {
  return {
    tool: {
      name: "TrustMCP",
      version: "0.1.0"
    },
    target: {
      input: sourceType === "local-directory" ? "./fixtures/local-risky" : "https://github.com/example/risky-mcp",
      displayName: sourceType === "local-directory" ? "./fixtures/local-risky" : "example/risky-mcp",
      sourceType
    },
    limitations: [
      "Static heuristics only.",
      "TrustMCP does not execute the target.",
      "No finding set should be interpreted as a safety guarantee."
    ],
    summary: {
      findingCount: severities.length,
      triggeredRuleCount: severities.length,
      severityCounts: {
        low: severities.filter((severity) => severity === "low").length,
        medium: severities.filter((severity) => severity === "medium").length,
        high: severities.filter((severity) => severity === "high").length
      },
      message: severities.length === 0
        ? "No matching rules were triggered. Static heuristics only; this does not mean the target is safe."
        : `${severities.length} finding(s) across ${severities.length} rule(s). Static heuristics only.`
    },
    findings: severities.map((severity, index) => ({
      ruleId: `rule-${index + 1}`,
      severity,
      confidence: "high",
      title: severity === "high"
        ? "Shell execution capability detected"
        : severity === "medium"
          ? "Outbound network request capability detected"
          : "Low severity placeholder finding",
      file: `src/example-${index + 1}.ts`,
      line: index + 1,
      evidence: `evidence-${index + 1}`,
      whyItMatters: `why-${index + 1}`,
      remediation: `remediation-${index + 1}`
    }))
  };
}

function createWriter(chunks: string[]) {
  return {
    write(chunk: string) {
      chunks.push(chunk);
    }
  };
}

async function createTempFilePath(fileName: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "trustmcp-cli-test-"));
  tempDirectories.push(directory);
  return join(directory, fileName);
}

async function createConfigFile(content: string): Promise<string> {
  const configPath = await createTempFilePath("trustmcp.config.json");
  await writeFile(configPath, content, "utf8");
  return configPath;
}
