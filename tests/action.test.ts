import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { runAction } from "../src/action/main.js";
import type { AuditReport, Severity } from "../src/core/types.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("runAction", () => {
  it("writes machine-readable summary outputs for a non-empty report", async () => {
    const outputPath = await createOutputPath();
    const summaryPath = await createSummaryPath();
    const stdout: string[] = [];

    const exitCode = await runAction(
      {
        target: "./fixtures/local-risky",
        format: "json",
        failOn: "high"
      },
      {
        auditTarget: async () => createReport("local-directory", ["high", "high", "medium"]),
        stdout: createWriter(stdout),
        githubOutputPath: outputPath,
        githubStepSummaryPath: summaryPath
      }
    );

    expect(exitCode).toBe(2);
    expect(stdout.join("")).toContain('"findingCount": 3');
    expect(await readOutputs(outputPath)).toEqual({
      "finding-count": "3",
      "low-count": "0",
      "medium-count": "1",
      "high-count": "2"
    });
    expect(await readFile(summaryPath, "utf8")).toBe(`# TrustMCP Report

- Target: \`./fixtures/local-risky\`
- Source: \`local-directory\`
- Findings: 3
- Rules triggered: 3
- Severity counts: low 0, medium 1, high 2
- Summary: 3 finding(s) across 3 rule(s). Static heuristics only.

## Findings

### 1. Shell execution capability detected
- Rule: \`rule-1\`
- Severity: \`high\`
- Confidence: \`high\`
- Location: \`src/example-1.ts:1\`
- Evidence: evidence-1
- Why it matters: why-1
- Remediation: remediation-1

### 2. Shell execution capability detected
- Rule: \`rule-2\`
- Severity: \`high\`
- Confidence: \`high\`
- Location: \`src/example-2.ts:2\`
- Evidence: evidence-2
- Why it matters: why-2
- Remediation: remediation-2

### 3. Outbound network request capability detected
- Rule: \`rule-3\`
- Severity: \`medium\`
- Confidence: \`high\`
- Location: \`src/example-3.ts:3\`
- Evidence: evidence-3
- Why it matters: why-3
- Remediation: remediation-3
`);
  });

  it("writes zeroed outputs for an empty report", async () => {
    const outputPath = await createOutputPath();

    const exitCode = await runAction(
      {
        target: "./fixtures/local-clean",
        format: "text"
      },
      {
        auditTarget: async () => createReport("local-directory", []),
        stdout: createWriter([]),
        githubOutputPath: outputPath
      }
    );

    expect(exitCode).toBe(0);
    expect(await readOutputs(outputPath)).toEqual({
      "finding-count": "0",
      "low-count": "0",
      "medium-count": "0",
      "high-count": "0"
    });
  });

  it("writes the rendered report to an explicit file path without changing outputs or stdout", async () => {
    const outputPath = await createOutputPath();
    const summaryPath = await createSummaryPath();
    const reportPath = await createReportPath();
    const stdout: string[] = [];

    const exitCode = await runAction(
      {
        target: "./fixtures/local-risky",
        format: "markdown",
        failOn: "high",
        outputFile: reportPath
      },
      {
        auditTarget: async () => createReport("local-directory", ["high", "medium"]),
        stdout: createWriter(stdout),
        githubOutputPath: outputPath,
        githubStepSummaryPath: summaryPath
      }
    );

    const reportContent = await readFile(reportPath, "utf8");

    expect(exitCode).toBe(2);
    expect(reportContent).toContain("# TrustMCP Report");
    expect(reportContent).toContain("Shell execution capability detected");
    expect(stdout.join("")).toBe(reportContent);
    expect(await readOutputs(outputPath)).toEqual({
      "finding-count": "2",
      "low-count": "0",
      "medium-count": "1",
      "high-count": "1"
    });
    expect(await readFile(summaryPath, "utf8")).toContain("# TrustMCP Report");
  });

  it("fails cleanly when the output-file directory does not exist", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "trustmcp-action-missing-dir-test-"));
    tempDirectories.push(tempDirectory);
    const missingReportPath = join(tempDirectory, "missing", "trustmcp-report.md");
    const stderr: string[] = [];

    const exitCode = await runAction(
      {
        target: "./fixtures/local-risky",
        format: "markdown",
        outputFile: missingReportPath
      },
      {
        auditTarget: async () => createReport("local-directory", ["high"]),
        stdout: createWriter([]),
        stderr: createWriter(stderr)
      }
    );

    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain(`Output file directory does not exist: ${join(tempDirectory, "missing")}`);
  });

  it("skips summary writing when the summary path is unavailable", async () => {
    const exitCode = await runAction(
      {
        target: "./fixtures/local-clean",
        format: "markdown"
      },
      {
        auditTarget: async () => createReport("local-directory", []),
        stdout: createWriter([])
      }
    );

    expect(exitCode).toBe(0);
  });

  it("loads config file to honor ignore lists and fail-on threshold", async () => {
    const configPath = await createConfigPath("trustmcp.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        "format": "markdown",
        "fail-on": "medium",
        "ignore-rules": ["rule-1"],
        "ignore-paths": ["src/vendor"]
      }),
      "utf8"
    );

    let receivedOptions: Record<string, unknown> | undefined;
    const stdout: string[] = [];

    const exitCode = await runAction(
      {
        target: "./fixtures/local-risky",
        configFile: configPath
      },
      {
        auditTarget: async (_target, options) => {
          receivedOptions = options;
          return createReport("local-directory", ["medium"]);
        },
        stdout: createWriter(stdout)
      }
    );

    expect(exitCode).toBe(2);
    expect(receivedOptions).toEqual({
      ignoreRules: ["rule-1"],
      ignorePaths: ["src/vendor"]
    });
    expect(stdout.join("")).toContain("# TrustMCP Report");
  });

  it("resolves relative config-file paths against the workspace directory", async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), "trustmcp-action-workspace-test-"));
    tempDirectories.push(workspaceDir);
    const configPath = join(workspaceDir, "trustmcp.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        "ignore-rules": ["rule-2"],
        "ignore-paths": ["src/vendor"]
      }),
      "utf8"
    );

    let receivedOptions: Record<string, unknown> | undefined;

    const exitCode = await runAction(
      {
        target: "./fixtures/local-risky",
        configFile: "trustmcp.config.json"
      },
      {
        workspaceDir,
        auditTarget: async (_target, options) => {
          receivedOptions = options;
          return createReport("local-directory", ["medium"]);
        },
        stdout: createWriter([])
      }
    );

    expect(exitCode).toBe(0);
    expect(receivedOptions).toEqual({
      ignoreRules: ["rule-2"],
      ignorePaths: ["src/vendor"]
    });
  });

  it("resolves config output-file paths relative to GITHUB_WORKSPACE", async () => {
    const workspace = await createTempDirectory("trustmcp-action-workspace-test-");
    const configPath = join(workspace, "trustmcp.config.json");
    const reportDirectory = join(workspace, "reports");
    const reportPath = join(reportDirectory, "trustmcp.md");
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify({
        "format": "markdown",
        "output-file": "reports/trustmcp.md"
      }),
      "utf8"
    );

    const previousWorkspace = process.env.GITHUB_WORKSPACE;
    process.env.GITHUB_WORKSPACE = workspace;

    try {
      const exitCode = await runAction(
        {
          target: "./fixtures/local-clean",
          configFile: configPath
        },
        {
          auditTarget: async () => createReport("local-directory", []),
          stdout: createWriter([])
        }
      );

      expect(exitCode).toBe(0);
      expect(await readFile(reportPath, "utf8")).toContain("# TrustMCP Report");
    } finally {
      if (previousWorkspace === undefined) {
        delete process.env.GITHUB_WORKSPACE;
      } else {
        process.env.GITHUB_WORKSPACE = previousWorkspace;
      }
    }
  });

  it("honors summary-only from config when rendering the action output", async () => {
    const configPath = await createConfigPath("trustmcp.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        "format": "markdown",
        "summary-only": true
      }),
      "utf8"
    );

    const stdout: string[] = [];

    const exitCode = await runAction(
      {
        target: "./fixtures/local-risky",
        configFile: configPath
      },
      {
        auditTarget: async () => createReport("local-directory", ["high"]),
        stdout: createWriter(stdout)
      }
    );

    const output = stdout.join("");
    expect(exitCode).toBe(0);
    expect(output).toContain("TrustMCP Summary");
    expect(output).not.toContain("## Findings");
  });

  it("honors explicit summary-only input for the action runner", async () => {
    const stdout: string[] = [];

    const exitCode = await runAction(
      {
        target: "./fixtures/local-risky",
        format: "markdown",
        summaryOnly: true
      },
      {
        auditTarget: async () => createReport("local-directory", ["medium"]),
        stdout: createWriter(stdout)
      }
    );

    const output = stdout.join("");
    expect(exitCode).toBe(0);
    expect(output).toContain("TrustMCP Summary");
    expect(output).not.toContain("## Findings");
  });

  it("fails early when summary-only is combined with sarif format", async () => {
    const stderr: string[] = [];

    const exitCode = await runAction(
      {
        target: "./fixtures/local-risky",
        format: "sarif",
        summaryOnly: true
      },
      {
        auditTarget: async () => createReport("local-directory", ["high"]),
        stderr: createWriter(stderr),
        stdout: createWriter([])
      }
    );

    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain("Invalid option combination in action inputs: --summary-only is not supported with --format sarif.");
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

async function createOutputPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "trustmcp-action-test-"));
  tempDirectories.push(directory);
  const outputPath = join(directory, "github-output.txt");
  await writeFile(outputPath, "", "utf8");
  return outputPath;
}

async function createSummaryPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "trustmcp-action-summary-test-"));
  tempDirectories.push(directory);
  const summaryPath = join(directory, "github-step-summary.md");
  await writeFile(summaryPath, "", "utf8");
  return summaryPath;
}

async function createReportPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "trustmcp-action-report-test-"));
  tempDirectories.push(directory);
  return join(directory, "trustmcp-report.md");
}

async function createConfigPath(fileName: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "trustmcp-action-config-test-"));
  tempDirectories.push(directory);
  return join(directory, fileName);
}

async function createTempDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  tempDirectories.push(directory);
  return directory;
}

async function readOutputs(outputPath: string): Promise<Record<string, string>> {
  const content = await readFile(outputPath, "utf8");
  return Object.fromEntries(
    content
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map((line) => {
        const equalsIndex = line.indexOf("=");
        return [line.slice(0, equalsIndex), line.slice(equalsIndex + 1)];
      })
  );
}
