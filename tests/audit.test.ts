import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { auditTarget } from "../src/core/audit.js";
import type { MaterializedSource } from "../src/core/types.js";

const localRiskyFixture = fileURLToPath(new URL("../fixtures/local-risky", import.meta.url));
const localCleanFixture = fileURLToPath(new URL("../fixtures/local-clean", import.meta.url));

describe("auditTarget", () => {
  it("reports the full risky fixture inventory across thirteen rules", async () => {
    const report = await auditTarget(localRiskyFixture);

    expect(report.findings).toHaveLength(23);
    expect(report.findings.map((finding) => finding.ruleId)).toEqual([
      "mcp/broad-filesystem",
      "mcp/broad-filesystem",
      "mcp/broad-filesystem",
      "mcp/download-write-exec",
      "mcp/dynamic-code-exec",
      "mcp/env-secret-exposure",
      "mcp/internal-network-access",
      "mcp/script-runner-exec",
      "mcp/shell-exec",
      "mcp/shell-exec",
      "mcp/shell-exec",
      "mcp/subprocess-network-exfil",
      "mcp/subprocess-network-exfil",
      "mcp/sensitive-local-data",
      "mcp/archive-extract",
      "mcp/archive-extract",
      "mcp/local-service-binding",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/tool-metadata-risk"
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
    expect(report.findings).toHaveLength(23);
    expect(new Set(report.findings.map((finding) => finding.ruleId))).toEqual(
      new Set([
        "mcp/shell-exec",
        "mcp/script-runner-exec",
        "mcp/outbound-fetch",
        "mcp/broad-filesystem",
        "mcp/download-write-exec",
        "mcp/dynamic-code-exec",
        "mcp/env-secret-exposure",
        "mcp/internal-network-access",
        "mcp/local-service-binding",
        "mcp/archive-extract",
        "mcp/sensitive-local-data",
        "mcp/subprocess-network-exfil",
        "mcp/tool-metadata-risk"
      ])
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
    expect(report.findings).toHaveLength(23);
  });

  it("preserves explicit requested refs through the GitHub scan pipeline", async () => {
    const report = await auditTarget("gh:example/risky-mcp@release-branch", {
      materializeGitHubRepository: async (input: string): Promise<MaterializedSource> => ({
        rootDir: localRiskyFixture,
        target: {
          input,
          displayName: "example/risky-mcp",
          sourceType: "public-github-repo",
          resolvedRef: "release-branch@abc123def456"
        }
      })
    });

    expect(report.target.input).toBe("gh:example/risky-mcp@release-branch");
    expect(report.target.resolvedRef).toBe("release-branch@abc123def456");
  });

  it("ignores findings for rules listed in options.ignoreRules", async () => {
    const report = await auditTarget(localRiskyFixture, {
      ignoreRules: ["mcp/shell-exec"]
    });

    expect(report.findings).toHaveLength(20);
    expect(report.findings.map((finding) => finding.ruleId).sort()).toEqual([
      "mcp/archive-extract",
      "mcp/archive-extract",
      "mcp/broad-filesystem",
      "mcp/broad-filesystem",
      "mcp/broad-filesystem",
      "mcp/download-write-exec",
      "mcp/dynamic-code-exec",
      "mcp/env-secret-exposure",
      "mcp/internal-network-access",
      "mcp/local-service-binding",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/script-runner-exec",
      "mcp/sensitive-local-data",
      "mcp/subprocess-network-exfil",
      "mcp/subprocess-network-exfil",
      "mcp/tool-metadata-risk"
    ]);
    expect(report.summary.findingCount).toBe(20);
    expect(report.summary.triggeredRuleCount).toBe(12);
    expect(report.summary.message).toContain("20 finding(s) across 12 rule(s)");
  });

  it("ignores findings whose files match options.ignorePaths", async () => {
    const report = await auditTarget(localRiskyFixture, {
      ignorePaths: ["src/network.ts"]
    });

    expect(report.findings).toHaveLength(22);
    expect(new Set(report.findings.map((finding) => finding.ruleId))).toEqual(
      new Set([
        "mcp/broad-filesystem",
        "mcp/download-write-exec",
        "mcp/dynamic-code-exec",
        "mcp/env-secret-exposure",
        "mcp/internal-network-access",
        "mcp/local-service-binding",
        "mcp/archive-extract",
        "mcp/outbound-fetch",
        "mcp/script-runner-exec",
        "mcp/sensitive-local-data",
        "mcp/shell-exec",
        "mcp/subprocess-network-exfil",
        "mcp/tool-metadata-risk"
      ])
    );
    expect(report.summary.findingCount).toBe(22);
    expect(report.summary.triggeredRuleCount).toBe(13);
    expect(report.summary.severityCounts.medium).toBe(8);
    expect(report.summary.message).toContain("22 finding(s) across 13 rule(s)");
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

  it("treats an empty baseline as baseline-enabled gating with zero accepted findings", async () => {
    const report = await auditTarget(localRiskyFixture, {
      baselineEntries: []
    });

    expect(report.summary.baselineApplied).toBe(true);
    expect(report.summary.findingCount).toBe(23);
    expect(report.summary.newFindingCount).toBe(23);
    expect(report.summary.gatedFindingCount).toBe(23);
    expect(report.summary.message).toContain("23 finding(s) across 13 rule(s)");
    expect(report.summary.message).toContain("23 new finding(s) across 13 rule(s)");
  });

  it("treats baseline entries as known findings without dropping the overall list", async () => {
    const report = await auditTarget(localRiskyFixture, {
      baselineEntries: [
        {
          fingerprint: "mcp/shell-exec|src/shell.ts|exec(args.command);",
          ruleId: "mcp/shell-exec",
          file: "src/shell.ts",
          line: 4
        }
      ]
    });

    expect(report.findings).toHaveLength(23);
    expect(report.summary.findingCount).toBe(23);
    expect(report.summary.newFindingCount).toBe(22);
    expect(report.newFindings.map((finding) => finding.ruleId).sort()).toEqual([
      "mcp/archive-extract",
      "mcp/archive-extract",
      "mcp/broad-filesystem",
      "mcp/broad-filesystem",
      "mcp/broad-filesystem",
      "mcp/download-write-exec",
      "mcp/dynamic-code-exec",
      "mcp/env-secret-exposure",
      "mcp/internal-network-access",
      "mcp/local-service-binding",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/script-runner-exec",
      "mcp/sensitive-local-data",
      "mcp/shell-exec",
      "mcp/shell-exec",
      "mcp/subprocess-network-exfil",
      "mcp/subprocess-network-exfil",
      "mcp/tool-metadata-risk"
    ]);
    expect(report.summary.message).toContain("23 finding(s) across 13 rule(s)");
    expect(report.summary.message).toContain("22 new finding(s) across 13 rule(s)");
  });

  it("matches baseline entries by fingerprint even when the stored line drifts", async () => {
    const report = await auditTarget(localRiskyFixture, {
      baselineEntries: [
        {
          fingerprint: "mcp/shell-exec|src/shell.ts|exec(args.command);",
          ruleId: "mcp/shell-exec",
          file: "src/shell.ts",
          line: 999
        }
      ]
    });

    expect(report.findings).toHaveLength(23);
    expect(report.newFindings.map((finding) => finding.ruleId).sort()).toEqual([
      "mcp/archive-extract",
      "mcp/archive-extract",
      "mcp/broad-filesystem",
      "mcp/broad-filesystem",
      "mcp/broad-filesystem",
      "mcp/download-write-exec",
      "mcp/dynamic-code-exec",
      "mcp/env-secret-exposure",
      "mcp/internal-network-access",
      "mcp/local-service-binding",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/script-runner-exec",
      "mcp/sensitive-local-data",
      "mcp/shell-exec",
      "mcp/shell-exec",
      "mcp/subprocess-network-exfil",
      "mcp/subprocess-network-exfil",
      "mcp/tool-metadata-risk"
    ]);
  });

  it("still honors legacy baseline entries without fingerprints", async () => {
    const report = await auditTarget(localRiskyFixture, {
      baselineEntries: [
        {
          ruleId: "mcp/shell-exec",
          file: "src/shell.ts",
          line: 4
        }
      ]
    });

    expect(report.findings).toHaveLength(23);
    expect(report.newFindings.map((finding) => finding.ruleId).sort()).toEqual([
      "mcp/archive-extract",
      "mcp/archive-extract",
      "mcp/broad-filesystem",
      "mcp/broad-filesystem",
      "mcp/broad-filesystem",
      "mcp/download-write-exec",
      "mcp/dynamic-code-exec",
      "mcp/env-secret-exposure",
      "mcp/internal-network-access",
      "mcp/local-service-binding",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/outbound-fetch",
      "mcp/script-runner-exec",
      "mcp/sensitive-local-data",
      "mcp/shell-exec",
      "mcp/shell-exec",
      "mcp/subprocess-network-exfil",
      "mcp/subprocess-network-exfil",
      "mcp/tool-metadata-risk"
    ]);
  });
});
