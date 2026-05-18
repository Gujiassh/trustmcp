import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { auditTarget } from "../src/core/audit.js";
import type { AuditReport } from "../src/core/types.js";
import { TRUSTMCP_VERSION } from "../src/core/version.js";
import { renderJsonReport } from "../src/renderers/json.js";
import { renderMarkdownReport } from "../src/renderers/markdown.js";
import { renderSummaryReport } from "../src/renderers/output.js";
import { renderSarifReport } from "../src/renderers/sarif.js";
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
    expect(parsed.summary.findingCount).toBe(23);
    expect(parsed.summary.severityCounts).toEqual({
      low: 0,
      medium: 9,
      high: 14
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
- Confidence reason: \`rule-specific-test-reason-1\`
- Location: \`src/example-1.ts:1\`
- Evidence: evidence-1
- Why it matters: why-1
- Remediation: remediation-1

### 2. Outbound network request capability detected
- Rule: \`mcp/outbound-fetch\`
- Severity: \`medium\`
- Confidence: \`high\`
- Confidence reason: \`rule-specific-test-reason-2\`
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
    "version": "${TRUSTMCP_VERSION}"
  },
  "target": {
    "input": "https://github.com/example/risky-mcp",
    "displayName": "example/risky-mcp",
    "sourceType": "public-github-repo",
    "resolvedRef": "main@abc123def456"
  },
  "summary": {
    "baselineApplied": false,
    "findingCount": 0,
    "newFindingCount": 0,
    "gatedFindingCount": 0,
    "triggeredRuleCount": 0,
    "newTriggeredRuleCount": 0,
    "gatedTriggeredRuleCount": 0,
    "severityCounts": {
      "low": 0,
      "medium": 0,
      "high": 0
    },
    "newSeverityCounts": {
      "low": 0,
      "medium": 0,
      "high": 0
    },
    "gatedSeverityCounts": {
      "low": 0,
      "medium": 0,
      "high": 0
    },
    "message": "No matching rules were triggered. Static heuristics only; this does not mean the target is safe."
  }
}`);
  });

  it("renders deterministic SARIF output", () => {
    expect(renderSarifReport(createReport(["high", "medium"]))).toBe(`{
  "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "TrustMCP",
          "version": "${TRUSTMCP_VERSION}",
          "informationUri": "https://github.com/Gujiassh/trustmcp",
          "rules": [
            {
              "id": "mcp/outbound-fetch",
              "shortDescription": {
                "text": "Outbound network request capability detected"
              },
              "fullDescription": {
                "text": "why-2"
              },
              "defaultConfiguration": {
                "level": "warning"
              },
              "help": {
                "text": "remediation-2"
              },
              "properties": {
                "ruleId": "mcp/outbound-fetch",
                "confidence": "high",
                "severity": "medium",
                "confidenceLevels": [
                  "medium",
                  "high"
                ],
                "confidenceReasons": [
                  "literal-fetch-call",
                  "non-fetch-network-client",
                  "tool-controlled-url"
                ],
                "confidenceGuidance": [
                  {
                    "level": "medium",
                    "reason": "literal-fetch-call",
                    "description": "A plain fetch call was matched without clear tool-controlled destination evidence."
                  },
                  {
                    "level": "high",
                    "reason": "non-fetch-network-client",
                    "description": "A stronger network client surface such as axios, http(s), got, or undici was matched."
                  },
                  {
                    "level": "high",
                    "reason": "tool-controlled-url",
                    "description": "The destination URL appears to come from tool or request input."
                  }
                ]
              }
            },
            {
              "id": "mcp/shell-exec",
              "shortDescription": {
                "text": "Shell execution capability detected"
              },
              "fullDescription": {
                "text": "why-1"
              },
              "defaultConfiguration": {
                "level": "error"
              },
              "help": {
                "text": "remediation-1"
              },
              "properties": {
                "ruleId": "mcp/shell-exec",
                "confidence": "high",
                "severity": "high",
                "confidenceLevels": [
                  "high"
                ],
                "confidenceReasons": [
                  "direct-command-execution-api"
                ],
                "confidenceGuidance": [
                  {
                    "level": "high",
                    "reason": "direct-command-execution-api",
                    "description": "Direct command execution primitives such as child_process, execa, or Bun.spawn were matched."
                  }
                ]
              }
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "mcp/shell-exec",
          "level": "error",
          "message": {
            "text": "Shell execution capability detected"
          },
          "partialFingerprints": {
            "primaryLocationLineHash": "mcp/shell-exec|src/example-1.ts|evidence-1"
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "src/example-1.ts"
                },
                "region": {
                  "startLine": 1
                }
              }
            }
          ],
          "properties": {
            "fingerprint": "mcp/shell-exec|src/example-1.ts|evidence-1",
            "baselineApplied": false,
            "isNewFinding": true,
            "isGatedFinding": true,
            "confidence": "high",
            "confidenceReason": "rule-specific-test-reason-1",
            "severity": "high",
            "evidence": "evidence-1",
            "whyItMatters": "why-1",
            "remediation": "remediation-1"
          }
        },
        {
          "ruleId": "mcp/outbound-fetch",
          "level": "warning",
          "message": {
            "text": "Outbound network request capability detected"
          },
          "partialFingerprints": {
            "primaryLocationLineHash": "mcp/outbound-fetch|src/example-2.ts|evidence-2"
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "src/example-2.ts"
                },
                "region": {
                  "startLine": 2
                }
              }
            }
          ],
          "properties": {
            "fingerprint": "mcp/outbound-fetch|src/example-2.ts|evidence-2",
            "baselineApplied": false,
            "isNewFinding": true,
            "isGatedFinding": true,
            "confidence": "high",
            "confidenceReason": "rule-specific-test-reason-2",
            "severity": "medium",
            "evidence": "evidence-2",
            "whyItMatters": "why-2",
            "remediation": "remediation-2"
          }
        }
      ]
    }
  ]
}`);
  });

  it("marks SARIF results with baseline and gated finding semantics", () => {
    const report = createReport(["high", "medium"]);
    report.summary.baselineApplied = true;
    report.summary.newFindingCount = 1;
    report.summary.gatedFindingCount = 1;
    report.summary.newTriggeredRuleCount = 1;
    report.summary.gatedTriggeredRuleCount = 1;
    report.summary.newSeverityCounts = { low: 0, medium: 0, high: 1 };
    report.summary.gatedSeverityCounts = { low: 0, medium: 0, high: 1 };
    report.summary.message = "2 finding(s) across 2 rule(s). Static heuristics only. 1 new finding(s) across 1 rule(s).";
    report.newFindings = report.findings.slice(0, 1);

    const parsed = JSON.parse(renderSarifReport(report)) as {
      runs: Array<{
        results: Array<{
          properties: {
            baselineApplied: boolean;
            isNewFinding: boolean;
            isGatedFinding: boolean;
          };
        }>;
      }>;
    };

    expect(parsed.runs[0]?.results[0]?.properties).toMatchObject({
      baselineApplied: true,
      isNewFinding: true,
      isGatedFinding: true
    });
    expect(parsed.runs[0]?.results[1]?.properties).toMatchObject({
      baselineApplied: true,
      isNewFinding: false,
      isGatedFinding: false
    });
  });
});

function createReport(severities: Array<"high" | "medium" | "low">): AuditReport {
    const findings = severities.map((severity, index) => ({
      fingerprint: `${severity === "high" ? "mcp/shell-exec" : severity === "medium" ? "mcp/outbound-fetch" : "mcp/example-low"}|src/example-${index + 1}.ts|evidence-${index + 1}`,
      ruleId: severity === "high" ? "mcp/shell-exec" : severity === "medium" ? "mcp/outbound-fetch" : "mcp/example-low",
      severity,
      confidence: "high" as const,
      confidenceReason: `rule-specific-test-reason-${index + 1}`,
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
  }));

  return {
    tool: {
      name: "TrustMCP",
      version: TRUSTMCP_VERSION
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
      baselineApplied: false,
      findingCount: severities.length,
      newFindingCount: severities.length,
      gatedFindingCount: severities.length,
      triggeredRuleCount: severities.length,
      newTriggeredRuleCount: severities.length,
      gatedTriggeredRuleCount: severities.length,
      severityCounts: {
        low: severities.filter((severity) => severity === "low").length,
        medium: severities.filter((severity) => severity === "medium").length,
        high: severities.filter((severity) => severity === "high").length
      },
      newSeverityCounts: {
        low: severities.filter((severity) => severity === "low").length,
        medium: severities.filter((severity) => severity === "medium").length,
        high: severities.filter((severity) => severity === "high").length
      },
      gatedSeverityCounts: {
        low: severities.filter((severity) => severity === "low").length,
        medium: severities.filter((severity) => severity === "medium").length,
        high: severities.filter((severity) => severity === "high").length
      },
      message: severities.length === 0
        ? "No matching rules were triggered. Static heuristics only; this does not mean the target is safe."
        : `${severities.length} finding(s) across ${severities.length} rule(s). Static heuristics only.`
    },
    findings,
    newFindings: findings
  };
}
