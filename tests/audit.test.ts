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
});
