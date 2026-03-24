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

  it("parses SARIF output format", () => {
    expect(parseArguments(["gh:modelcontextprotocol/servers", "--format", "sarif"])).toEqual({
      target: "gh:modelcontextprotocol/servers",
      format: "sarif"
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

  it("parses init-config with the default output path", () => {
    expect(parseArguments(["init-config"])).toEqual({
      initConfig: true,
      outputPath: "trustmcp.config.json"
    });
  });

  it("parses init-config with an explicit output path", () => {
    expect(parseArguments(["init-config", "configs/trustmcp.config.json"])).toEqual({
      initConfig: true,
      outputPath: "configs/trustmcp.config.json"
    });
  });

  it("parses doctor with target and optional config", () => {
    expect(parseArguments(["doctor", "gh:modelcontextprotocol/servers"])).toEqual({
      doctor: true,
      target: "gh:modelcontextprotocol/servers"
    });
    expect(parseArguments(["doctor", "./fixtures/local-risky", "--config", "trustmcp.config.json"])).toEqual({
      doctor: true,
      target: "./fixtures/local-risky",
      configFile: "trustmcp.config.json"
    });
  });

  it("parses list-rules with no extra arguments", () => {
    expect(parseArguments(["list-rules"])).toEqual({
      listRules: true
    });
  });

  it("rejects invalid format values", () => {
    expect(() => parseArguments(["./fixtures/local-risky", "--format", "html"]))
      .toThrowError("--format expects one of: text, json, markdown, sarif.");
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

  it("rejects extra init-config positional arguments", () => {
    expect(() => parseArguments(["init-config", "one.json", "two.json"]))
      .toThrowError("init-config accepts at most one optional output path.");
  });

  it("rejects extra doctor positional arguments", () => {
    expect(() => parseArguments(["doctor", "one", "two"]))
      .toThrowError("doctor accepts exactly one target: a local directory, GitHub repository URL, or gh:owner/repo.");
  });

  it("rejects extra list-rules arguments", () => {
    expect(() => parseArguments(["list-rules", "extra"]))
      .toThrowError("list-rules does not accept additional arguments.");
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

  it("renders deterministic SARIF through the CLI and writes it to disk", async () => {
    const outputFile = await createTempFilePath("trustmcp-report.sarif");
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--format",
      "sarif",
      "--output-file",
      outputFile
    ], {
      auditTarget: async () => createReport("local-directory", ["high", "medium"]),
      stdout: createWriter(stdout)
    });

    const stdoutContent = stdout.join("");
    const fileContent = await readFile(outputFile, "utf8");
    const parsed = JSON.parse(stdoutContent) as {
      version: string;
      runs: Array<{ results: Array<{ ruleId: string }> }>;
    };

    expect(exitCode).toBe(0);
    expect(stdoutContent).toBe(fileContent);
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs[0]?.results).toHaveLength(2);
    expect(parsed.runs[0]?.results[0]?.ruleId).toBe("rule-1");
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
    expect(stderr.join("")).toContain("has invalid 'format'. Expected one of: text, json, markdown, sarif.");
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

  it("writes a starter config file with the supported stable fields", async () => {
    const outputFile = await createTempFilePath("trustmcp.config.json");
    const stdout: string[] = [];

    const exitCode = await runCli(["init-config", outputFile], {
      stdout: createWriter(stdout)
    });

    const fileContent = await readFile(outputFile, "utf8");
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toBe(`Wrote starter config to ${outputFile}\n`);
    expect(fileContent).toBe(`{
  "format": "markdown",
  "fail-on": "high",
  "summary-only": false,
  "output-file": "trustmcp-report.md"
}
`);
  });

  it("refuses to overwrite an existing config file", async () => {
    const outputFile = await createTempFilePath("trustmcp.config.json");
    const stderr: string[] = [];
    await writeFile(outputFile, "{}\n", "utf8");

    const exitCode = await runCli(["init-config", outputFile], {
      stdout: createWriter([]),
      stderr: createWriter(stderr)
    });

    expect(exitCode).toBe(1);
    expect(stderr.join("")).toBe(`TrustMCP error: Config file already exists: ${outputFile}\n`);
    expect(await readFile(outputFile, "utf8")).toBe("{}\n");
  });

  it("prints the shipped rule set in a compact stable form", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli(["list-rules"], {
      auditTarget: async () => {
        throw new Error("list-rules should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toBe(
      "ruleId\tseverity\ttitle\n" +
      "mcp/broad-filesystem\thigh\tFilesystem access using broad or tool-controlled paths detected\n" +
      "mcp/outbound-fetch\tmedium\tOutbound network request capability detected\n" +
      "mcp/shell-exec\thigh\tShell execution capability detected\n"
    );
  });

  it("runs doctor successfully for a valid local target and config without invoking the scan engine", async () => {
    const configFile = await createConfigFile(JSON.stringify({ format: "json" }));
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--config",
      configFile
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("TrustMCP doctor");
    expect(stdout.join("")).toContain(`Config: OK ${configFile}`);
    expect(stdout.join("")).toContain("Target: OK local directory");
    expect(stdout.join("")).toContain("Status: ready to scan.");
  });

  it("reports unsupported GitHub tree URLs compactly in doctor", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "https://github.com/modelcontextprotocol/servers/tree/main"
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toContain("Target: ERROR GitHub tree URLs are not supported.");
    expect(stdout.join("")).toContain("Use the repository root URL instead: https://github.com/modelcontextprotocol/servers");
    expect(stdout.join("")).toContain("Status: fix the errors above and run doctor again.");
  });

  it("reports invalid gh shorthand compactly in doctor", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli(["doctor", "gh:modelcontextprotocol"], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toContain("Target: ERROR GitHub shorthand inputs must look like gh:<owner>/<repo>.");
  });

  it("reports missing local directories compactly in doctor", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli(["doctor", "./fixtures/does-not-exist"], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toContain("Target: ERROR Local directory not found: ./fixtures/does-not-exist");
  });

  it("reports invalid config files in doctor", async () => {
    const configFile = await createConfigFile(JSON.stringify({ format: "html" }));
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--config",
      configFile
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toContain("Config: ERROR Config file");
    expect(stdout.join("")).toContain("has invalid 'format'. Expected one of: text, json, markdown, sarif.");
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
