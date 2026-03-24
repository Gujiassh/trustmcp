import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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
        githubOutputPath: outputPath
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
