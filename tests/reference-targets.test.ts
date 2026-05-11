import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildReferenceTargetScanPayload,
  loadReferenceTargetManifest,
  renderReferenceTargetManifestJson,
  renderReferenceTargetManifestText,
  renderReferenceTargetScanJson,
  renderReferenceTargetScanText,
  scanReferenceTargets,
  validateReferenceTargetExpectations
} from "../src/package/reference-targets.js";

const manifestPath = fileURLToPath(new URL("../fixtures/reference-targets.json", import.meta.url));
const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));

describe("reference target manifest", () => {
  it("defines the expected release-confidence target categories", async () => {
    const parsed = await loadReferenceTargetManifest(manifestPath);

    expect(parsed.targets.map((entry) => entry.expectedCategory).sort()).toEqual([
      "finding-producing",
      "mostly-clean",
      "sarif-relevant"
    ]);
  });

  it("keeps each reference target rooted at a public GitHub repository URL", async () => {
    const parsed = await loadReferenceTargetManifest(manifestPath);

    for (const entry of parsed.targets) {
      expect(entry.target, entry.id).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
      expect(entry.notes.trim().length, entry.id).toBeGreaterThan(0);
    }
  });

  it("keeps the README pinned real-scan examples aligned with the checked-in manifest", async () => {
    const parsed = await loadReferenceTargetManifest(manifestPath);
    const readme = await readFile(readmePath, "utf8");

    const findingTarget = parsed.targets.find((entry) => entry.id === "finding-producing");
    const cleanTarget = parsed.targets.find((entry) => entry.id === "mostly-clean");

    expect(findingTarget).toBeDefined();
    expect(cleanTarget).toBeDefined();

    const findingUrl = new URL(findingTarget!.target);
    const cleanUrl = new URL(cleanTarget!.target);
    const findingRepo = findingUrl.pathname.slice(1);
    const cleanRepo = cleanUrl.pathname.slice(1);
    const findingRef = findingUrl.searchParams.get("ref");
    const cleanRef = cleanUrl.searchParams.get("ref");

    expect(readme).toContain(`on \`${findingRepo}\``);
    expect(readme).toContain(`on \`${cleanRepo}\``);
    expect(findingRef).not.toBeNull();
    expect(cleanRef).not.toBeNull();
    expect(readme).toContain(`At pinned ref \`${findingRef}\``);
    expect(readme).toContain(`at pinned ref \`${cleanRef}\``);
  });

  it("renders the manifest and scan outputs as stable text", async () => {
    const manifest = await loadReferenceTargetManifest(manifestPath);
    expect(renderReferenceTargetManifestText(manifest)).toContain("Reference target manifest OK");

    const payload = buildReferenceTargetScanPayload([
      {
        id: "finding-producing",
        target: "https://github.com/example/finding-producing",
        expectedCategory: "finding-producing",
        displayName: "example/finding-producing",
        resolvedRef: "main@abc123def456",
        findingCount: 1,
        ruleCount: 1,
        summaryMessage: "1 finding(s) across 1 rule(s). Static heuristics only."
      }
    ]);

    expect(renderReferenceTargetScanText(payload)).toEqual({
      stdout: "Reference target scan run OK\n- finding-producing: finding-producing -> example/finding-producing @ main@abc123def456 (1 finding(s), 1 rule(s))",
      stderr: []
    });
  });

  it("renders the manifest and scan outputs as stable JSON", async () => {
    const manifest = await loadReferenceTargetManifest(manifestPath);
    expect(JSON.parse(renderReferenceTargetManifestJson(manifest))).toMatchObject({
      targets: expect.any(Array)
    });

    const payload = buildReferenceTargetScanPayload([
      {
        id: "finding-producing",
        target: "https://github.com/example/finding-producing",
        expectedCategory: "finding-producing",
        displayName: "example/finding-producing",
        resolvedRef: "main@abc123def456",
        findingCount: 1,
        ruleCount: 1,
        summaryMessage: "1 finding(s) across 1 rule(s). Static heuristics only."
      }
    ]);

    expect(JSON.parse(renderReferenceTargetScanJson(payload))).toMatchObject({
      ok: true,
      failures: [],
      targets: [
        {
          id: "finding-producing",
          expectedCategory: "finding-producing",
          displayName: "example/finding-producing",
          resolvedRef: "main@abc123def456",
          findingCount: 1,
          ruleCount: 1
        }
      ]
    });
  });

  it("can scan the checked-in reference targets through an injected audit function", async () => {
    const parsed = await loadReferenceTargetManifest(manifestPath);

    const results = await scanReferenceTargets(parsed.targets, async (target) => ({
      tool: {
        name: "TrustMCP",
        version: "0.2.0-dev"
      },
      target: {
        input: target,
        displayName: target.replace(/^https:\/\/github\.com\//, ""),
        sourceType: "public-github-repo",
        resolvedRef: "main@abc123def456"
      },
      limitations: [],
      summary: {
        baselineApplied: false,
        findingCount: 1,
        newFindingCount: 1,
        gatedFindingCount: 1,
        triggeredRuleCount: 1,
        newTriggeredRuleCount: 1,
        gatedTriggeredRuleCount: 1,
        severityCounts: { low: 0, medium: 0, high: 1 },
        newSeverityCounts: { low: 0, medium: 0, high: 1 },
        gatedSeverityCounts: { low: 0, medium: 0, high: 1 },
        message: "1 finding(s) across 1 rule(s). Static heuristics only."
      },
      findings: [],
      newFindings: []
    }));

    expect(results).toHaveLength(3);
    expect(results[0]?.resolvedRef).toBe("main@abc123def456");
  });

  it("produces stable scan summary rows for the reference target harness", async () => {
    const parsed = await loadReferenceTargetManifest(manifestPath);

    const results = await scanReferenceTargets(parsed.targets, async (target) => ({
      tool: {
        name: "TrustMCP",
        version: "0.2.0-dev"
      },
      target: {
        input: target,
        displayName: target.replace(/^https:\/\/github\.com\//, ""),
        sourceType: "public-github-repo",
        resolvedRef: "release-branch@abc123def456"
      },
      limitations: [],
      summary: {
        baselineApplied: false,
        findingCount: 2,
        newFindingCount: 2,
        gatedFindingCount: 2,
        triggeredRuleCount: 1,
        newTriggeredRuleCount: 1,
        gatedTriggeredRuleCount: 1,
        severityCounts: { low: 0, medium: 0, high: 2 },
        newSeverityCounts: { low: 0, medium: 0, high: 2 },
        gatedSeverityCounts: { low: 0, medium: 0, high: 2 },
        message: "2 finding(s) across 1 rule(s). Static heuristics only."
      },
      findings: [],
      newFindings: []
    }));

    expect(results[0]).toMatchObject({
      id: "finding-producing",
      expectedCategory: "finding-producing",
      findingCount: 2,
      ruleCount: 1,
      summaryMessage: "2 finding(s) across 1 rule(s). Static heuristics only.",
      resolvedRef: "release-branch@abc123def456"
    });
  });

  it("can be serialized as stable JSON payloads for manifest and scan results", async () => {
    const parsed = await loadReferenceTargetManifest(manifestPath);
    expect(JSON.parse(JSON.stringify(parsed))).toMatchObject({
      targets: expect.any(Array)
    });

    const results = await scanReferenceTargets(parsed.targets, async (target) => ({
      tool: {
        name: "TrustMCP",
        version: "0.2.0-dev"
      },
      target: {
        input: target,
        displayName: target.replace(/^https:\/\/github\.com\//, ""),
        sourceType: "public-github-repo",
        resolvedRef: "release-branch@abc123def456"
      },
      limitations: [],
      summary: {
        baselineApplied: false,
        findingCount: 2,
        newFindingCount: 2,
        gatedFindingCount: 2,
        triggeredRuleCount: 1,
        newTriggeredRuleCount: 1,
        gatedTriggeredRuleCount: 1,
        severityCounts: { low: 0, medium: 0, high: 2 },
        newSeverityCounts: { low: 0, medium: 0, high: 2 },
        gatedSeverityCounts: { low: 0, medium: 0, high: 2 },
        message: "2 finding(s) across 1 rule(s). Static heuristics only."
      },
      findings: [],
      newFindings: []
    }));

    const serialized = JSON.parse(JSON.stringify({ targets: results })) as {
      targets: Array<Record<string, unknown>>;
    };

    expect(serialized.targets[0]).toMatchObject({
      id: "finding-producing",
      expectedCategory: "finding-producing",
      displayName: expect.any(String),
      resolvedRef: "release-branch@abc123def456",
      findingCount: 2,
      ruleCount: 1
    });
  });

  it("validates reference target category expectations", () => {
    expect(validateReferenceTargetExpectations([
      {
        id: "finding-producing",
        target: "https://github.com/example/finding-producing",
        expectedCategory: "finding-producing",
        displayName: "example/finding-producing",
        findingCount: 1,
        ruleCount: 1,
        summaryMessage: "1 finding(s) across 1 rule(s)."
      },
      {
        id: "mostly-clean",
        target: "https://github.com/example/mostly-clean",
        expectedCategory: "mostly-clean",
        displayName: "example/mostly-clean",
        findingCount: 0,
        ruleCount: 0,
        summaryMessage: "No matching rules were triggered."
      },
      {
        id: "sarif-relevant",
        target: "https://github.com/example/sarif-relevant",
        expectedCategory: "sarif-relevant",
        displayName: "example/sarif-relevant",
        findingCount: 2,
        ruleCount: 1,
        summaryMessage: "2 finding(s) across 1 rule(s)."
      }
    ])).toEqual({
      ok: true,
      failures: []
    });

    expect(validateReferenceTargetExpectations([
      {
        id: "finding-producing",
        target: "https://github.com/example/finding-producing",
        expectedCategory: "finding-producing",
        displayName: "example/finding-producing",
        findingCount: 0,
        ruleCount: 0,
        summaryMessage: "No matching rules were triggered."
      },
      {
        id: "mostly-clean",
        target: "https://github.com/example/mostly-clean",
        expectedCategory: "mostly-clean",
        displayName: "example/mostly-clean",
        findingCount: 3,
        ruleCount: 1,
        summaryMessage: "3 finding(s) across 1 rule(s)."
      },
      {
        id: "sarif-relevant",
        target: "https://github.com/example/sarif-relevant",
        expectedCategory: "sarif-relevant",
        displayName: "example/sarif-relevant",
        findingCount: 0,
        ruleCount: 0,
        summaryMessage: "No matching rules were triggered."
      }
    ])).toEqual({
      ok: false,
      failures: [
        "finding-producing expected findings but reported none.",
        "mostly-clean expected a mostly-clean/no-match result but reported 3 finding(s).",
        "sarif-relevant expected a meaningful SARIF inspection target but reported no findings and no triggered rules."
      ]
    });
  });
});
