import { describe, expect, it } from "vitest";

import type { AuditReport, Severity } from "../src/core/types.js";
import { parseArguments, runCli } from "../src/cli/main.js";

describe("parseArguments", () => {
  it("parses --fail-on with a separate severity argument", () => {
    expect(parseArguments(["./fixtures/local-risky", "--fail-on", "medium"])).toEqual({
      target: "./fixtures/local-risky",
      format: "text",
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
