import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { auditTarget } from "../src/core/audit.js";
import type { MaterializedSource } from "../src/core/types.js";

const localRiskyFixture = fileURLToPath(new URL("../fixtures/local-risky", import.meta.url));
const localCleanFixture = fileURLToPath(new URL("../fixtures/local-clean", import.meta.url));

describe("auditTarget", () => {
  it("reports the three required rules for the risky fixture", async () => {
    const report = await auditTarget(localRiskyFixture);

    expect(report.findings).toHaveLength(3);
    expect(report.findings.map((finding) => finding.ruleId)).toEqual([
      "mcp/broad-filesystem",
      "mcp/shell-exec",
      "mcp/outbound-fetch"
    ]);

    for (const finding of report.findings) {
      expect(finding.title.length).toBeGreaterThan(0);
      expect(finding.file.length).toBeGreaterThan(0);
      expect(finding.evidence.length).toBeGreaterThan(0);
      expect(finding.whyItMatters.length).toBeGreaterThan(0);
      expect(finding.remediation.length).toBeGreaterThan(0);
    }
  });

  it("says no matching rules were triggered for the clean fixture", async () => {
    const report = await auditTarget(localCleanFixture);

    expect(report.findings).toHaveLength(0);
    expect(report.summary.message).toContain("No matching rules were triggered.");
    expect(report.summary.message).toContain("does not mean the target is safe");
  });

  it("uses the same scan pipeline for a GitHub target after materialization", async () => {
    const report = await auditTarget("https://github.com/example/risky-mcp", {
      materializeGitHubRepository: async (input: string): Promise<MaterializedSource> => ({
        rootDir: localRiskyFixture,
        target: {
          input,
          displayName: "example/risky-mcp",
          sourceType: "public-github-repo",
          resolvedRef: "main@abc123def456"
        }
      })
    });

    expect(report.target.sourceType).toBe("public-github-repo");
    expect(report.target.resolvedRef).toBe("main@abc123def456");
    expect(report.findings).toHaveLength(3);
    expect(new Set(report.findings.map((finding) => finding.ruleId))).toEqual(
      new Set(["mcp/shell-exec", "mcp/outbound-fetch", "mcp/broad-filesystem"])
    );
  });

  it("routes gh shorthand through the existing GitHub scan pipeline", async () => {
    const report = await auditTarget("gh:example/risky-mcp", {
      materializeGitHubRepository: async (input: string): Promise<MaterializedSource> => ({
        rootDir: localRiskyFixture,
        target: {
          input,
          displayName: "example/risky-mcp",
          sourceType: "public-github-repo",
          resolvedRef: "main@abc123def456"
        }
      })
    });

    expect(report.target.sourceType).toBe("public-github-repo");
    expect(report.target.input).toBe("gh:example/risky-mcp");
    expect(report.findings).toHaveLength(3);
  });

  it("ignores findings for rules listed in options.ignoreRules", async () => {
    const report = await auditTarget(localRiskyFixture, {
      ignoreRules: ["mcp/shell-exec"]
    });

    expect(report.findings).toHaveLength(2);
    expect(report.findings.map((finding) => finding.ruleId).sort()).toEqual([
      "mcp/broad-filesystem",
      "mcp/outbound-fetch"
    ]);
    expect(report.summary.findingCount).toBe(2);
    expect(report.summary.triggeredRuleCount).toBe(2);
    expect(report.summary.message).toContain("2 finding(s) across 2 rule(s)");
  });

  it("ignores findings whose files match options.ignorePaths", async () => {
    const report = await auditTarget(localRiskyFixture, {
      ignorePaths: ["src/network.ts"]
    });

    expect(report.findings).toHaveLength(2);
    expect(new Set(report.findings.map((finding) => finding.ruleId))).toEqual(
      new Set(["mcp/broad-filesystem", "mcp/shell-exec"])
    );
    expect(report.summary.findingCount).toBe(2);
    expect(report.summary.triggeredRuleCount).toBe(2);
    expect(report.summary.severityCounts.medium).toBe(0);
    expect(report.summary.message).toContain("2 finding(s) across 2 rule(s)");
  });

  it("treats ignorePaths entries as literal directory prefixes", async () => {
    const report = await auditTarget(localRiskyFixture, {
      ignorePaths: ["src"]
    });

    expect(report.findings).toHaveLength(0);
    expect(report.summary.findingCount).toBe(0);
    expect(report.summary.triggeredRuleCount).toBe(0);
    expect(report.summary.message).toContain("No matching rules were triggered.");
  });

  it("treats baseline entries as known findings without dropping the overall list", async () => {
    const report = await auditTarget(localRiskyFixture, {
      baselineEntries: [
        { ruleId: "mcp/shell-exec", file: "src/shell.ts", line: 4 }
      ]
    });

    expect(report.findings).toHaveLength(3);
    expect(report.summary.findingCount).toBe(3);
    expect(report.summary.newFindingCount).toBe(2);
    expect(report.newFindings.map((finding) => finding.ruleId).sort()).toEqual([
      "mcp/broad-filesystem",
      "mcp/outbound-fetch"
    ]);
    expect(report.summary.message).toContain("2 new finding(s) across 2 rule(s)");
  });
});
