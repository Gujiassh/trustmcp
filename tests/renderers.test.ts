import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { auditTarget } from "../src/core/audit.js";
import type { AuditReport } from "../src/core/types.js";
import { renderJsonReport } from "../src/renderers/json.js";
import { renderMarkdownReport } from "../src/renderers/markdown.js";
import { renderSummaryReport } from "../src/renderers/output.js";
import { renderTextReport } from "../src/renderers/text.js";

const localRiskyFixture = fileURLToPath(new URL("../fixtures/local-risky", import.meta.url));
const localCleanFixture = fileURLToPath(new URL("../fixtures/local-clean", import.meta.url));

describe("renderers", () => {
  it("renders stable JSON output", async () => {
    const first = renderJsonReport(await auditTarget(localRiskyFixture));
    const second = renderJsonReport(await auditTarget(localRiskyFixture));
    const parsed = JSON.parse(first) as {
      summary: {
        findingCount: number;
        severityCounts: {
          low: number;
          medium: number;
          high: number;
        };
      };
      findings: Array<{ ruleId: string }>;
    };

    expect(first).toBe(second);
    expect(parsed.summary.findingCount).toBe(3);
    expect(parsed.summary.severityCounts).toEqual({
      low: 0,
      medium: 1,
      high: 2
    });
    expect(parsed.findings[0]?.ruleId).toBe("mcp/broad-filesystem");
  });

  it("renders zeroed severity counters for no-match JSON output", async () => {
    const parsed = JSON.parse(renderJsonReport(await auditTarget(localCleanFixture))) as {
      summary: {
        findingCount: number;
        severityCounts: {
          low: number;
          medium: number;
          high: number;
        };
      };
      findings: unknown[];
    };

    expect(parsed.summary.findingCount).toBe(0);
    expect(parsed.summary.severityCounts).toEqual({
      low: 0,
      medium: 0,
      high: 0
    });
    expect(parsed.findings).toEqual([]);
  });

  it("renders the no-match text without claiming safety", async () => {
    const report = await auditTarget(localCleanFixture);
    const rendered = renderTextReport(report);

    expect(rendered).toContain("No matching rules were triggered.");
    expect(rendered).toContain("does not mean the target is safe");
  });

  it("renders deterministic markdown for findings", () => {
    const first = renderMarkdownReport(createReport(["high", "medium"]));
    const second = renderMarkdownReport(createReport(["high", "medium"]));

    expect(first).toBe(second);
    expect(first).toBe(`# TrustMCP Report

- Target: \`example/risky-mcp\`
- Source: \`public-github-repo\`
- Ref: \`main@abc123def456\`
- Findings: 2
- Rules triggered: 2
- Severity counts: low 0, medium 1, high 1
- Summary: 2 finding(s) across 2 rule(s). Static heuristics only.

## Findings

### 1. Shell execution capability detected
- Rule: \`mcp/shell-exec\`
- Severity: \`high\`
- Confidence: \`high\`
- Location: \`src/example-1.ts:1\`
- Evidence: evidence-1
- Why it matters: why-1
- Remediation: remediation-1

### 2. Outbound network request capability detected
- Rule: \`mcp/outbound-fetch\`
- Severity: \`medium\`
- Confidence: \`high\`
- Location: \`src/example-2.ts:2\`
- Evidence: evidence-2
- Why it matters: why-2
- Remediation: remediation-2`);
  });

  it("renders deterministic markdown for empty reports", () => {
    expect(renderMarkdownReport(createReport([]))).toBe(`# TrustMCP Report

- Target: \`example/risky-mcp\`
- Source: \`public-github-repo\`
- Ref: \`main@abc123def456\`
- Findings: 0
- Rules triggered: 0
- Severity counts: low 0, medium 0, high 0
- Summary: No matching rules were triggered. Static heuristics only; this does not mean the target is safe.

## Findings

No matching rules were triggered.`);
  });

  it("renders deterministic summary-only markdown", () => {
    expect(renderSummaryReport(createReport(["high", "medium"]), "markdown")).toBe(`# TrustMCP Summary

- Target: \`example/risky-mcp\`
- Source: \`public-github-repo\`
- Ref: \`main@abc123def456\`
- Findings: 2
- Rules triggered: 2
- Severity counts: low 0, medium 1, high 1
- Summary: 2 finding(s) across 2 rule(s). Static heuristics only.`);
  });

  it("renders deterministic summary-only json without findings", () => {
    expect(renderSummaryReport(createReport([]), "json")).toBe(`{
  "tool": {
    "name": "TrustMCP",
    "version": "0.1.0"
  },
  "target": {
    "input": "https://github.com/example/risky-mcp",
    "displayName": "example/risky-mcp",
    "sourceType": "public-github-repo",
    "resolvedRef": "main@abc123def456"
  },
  "summary": {
    "findingCount": 0,
    "triggeredRuleCount": 0,
    "severityCounts": {
      "low": 0,
      "medium": 0,
      "high": 0
    },
    "message": "No matching rules were triggered. Static heuristics only; this does not mean the target is safe."
  }
}`);
  });
});

function createReport(severities: Array<"high" | "medium" | "low">): AuditReport {
  return {
    tool: {
      name: "TrustMCP",
      version: "0.1.0"
    },
    target: {
      input: "https://github.com/example/risky-mcp",
      displayName: "example/risky-mcp",
      sourceType: "public-github-repo",
      resolvedRef: "main@abc123def456"
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
      ruleId: severity === "high" ? "mcp/shell-exec" : severity === "medium" ? "mcp/outbound-fetch" : "mcp/example-low",
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
