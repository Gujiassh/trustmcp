import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));
const troubleshootingPath = fileURLToPath(new URL("../docs/troubleshooting.md", import.meta.url));
const whatScansPath = fileURLToPath(new URL("../docs/what-trustmcp-scans.md", import.meta.url));
const longTermSpecPath = fileURLToPath(new URL("../docs/ssot/long-term-development-spec.md", import.meta.url));
const executionBreakdownPath = fileURLToPath(new URL("../docs/ssot/execution-breakdown.md", import.meta.url));
const publishChecklistPath = fileURLToPath(new URL("../docs/npm-publish-checklist.md", import.meta.url));
const installingPath = fileURLToPath(new URL("../docs/installing-trustmcp.md", import.meta.url));
const contributingPath = fileURLToPath(new URL("../CONTRIBUTING.md", import.meta.url));
const machineReadableContractPath = fileURLToPath(new URL("../docs/machine-readable-output-contract.md", import.meta.url));
const contributorTaskMapPath = fileURLToPath(new URL("../docs/contributor-task-map.md", import.meta.url));
const releaseConfidencePath = fileURLToPath(new URL("../docs/release-confidence-and-reference-targets.md", import.meta.url));
const referenceTargetsPath = fileURLToPath(new URL("../fixtures/reference-targets.json", import.meta.url));

describe("docs coherence", () => {
  it("keeps the public scanner-surface docs aligned with the thirteen-rule baseline", async () => {
    const whatScans = await readFile(whatScansPath, "utf8");
    const troubleshooting = await readFile(troubleshootingPath, "utf8");

    expect(whatScans).toContain("TrustMCP currently ships thirteen static rules");
    expect(troubleshooting).toContain("TrustMCP currently ships thirteen rules.");
    expect(whatScans).toContain("mcp/internal-network-access");
    expect(whatScans).toContain("reach local, private, or metadata-service network targets");
  });

  it("keeps machine-readable rule metadata entry points visible in user-facing docs", async () => {
    const readme = await readFile(readmePath, "utf8");
    const whatScans = await readFile(whatScansPath, "utf8");
    const troubleshooting = await readFile(troubleshootingPath, "utf8");

    expect(readme).toContain("node dist/cli/main.js list-rules --json");
    expect(readme).toContain("confidenceLevels");
    expect(readme).toContain("confidenceGuidance");
    expect(readme).toContain("jq -r '.[] | \"\\(.id)\\t\\(.severity)\"'");
    expect(readme).toContain("select(.id == \"mcp/outbound-fetch\") | .confidenceReasons[]");
    expect(readme).toContain("Use `list-rules --json` for shipped rule metadata");
    expect(whatScans).toContain("node dist/cli/main.js list-rules --json");
    expect(troubleshooting).toContain("node dist/cli/main.js list-rules --json");
  });

  it("keeps rule metadata consumer examples documented", async () => {
    const machineReadableContract = await readFile(machineReadableContractPath, "utf8");
    const contributorTaskMap = await readFile(contributorTaskMapPath, "utf8");

    expect(machineReadableContract).toContain("It describes the scanner's rule inventory, not the findings from a specific scan.");
    expect(machineReadableContract).toContain("jq -r '.[] | \"\\(.id)\\t\\(.severity)\"'");
    expect(machineReadableContract).toContain("select(.id == \"mcp/outbound-fetch\") | .confidenceReasons[]");
    expect(contributorTaskMap).toContain("select(.id == \"mcp/outbound-fetch\") | .confidenceReasons[]");
  });

  it("keeps internal roadmap docs from drifting back to the original three-rule baseline", async () => {
    const longTermSpec = await readFile(longTermSpecPath, "utf8");
    const executionBreakdown = await readFile(executionBreakdownPath, "utf8");

    expect(longTermSpec).not.toContain("three capability-focused rules");
    expect(longTermSpec).not.toContain("## Phase 1: `v0.2` foundation hardening");
    expect(longTermSpec).not.toContain("Objective: make TrustMCP more dependable for repeated CI use without changing its product shape.");
    expect(longTermSpec).not.toContain("add 2-4 high-value rules in adjacent capability areas");
    expect(longTermSpec).not.toContain("formalize JSON/output compatibility expectations");
    expect(longTermSpec).toContain("0.2.0-dev");
    expect(longTermSpec).toContain("Completed Phase 1: `v0.2` foundation hardening");
    expect(longTermSpec).toContain("Treat this phase as historical context");
    expect(executionBreakdown).toContain("Foundation Slices Already Completed In `0.2.0-dev`");
    expect(executionBreakdown).toContain("Completed: Rule Metadata Consumer Examples");
    expect(executionBreakdown).toContain("Completed: Release And Reference-Target Guardrail Tightening");
    expect(executionBreakdown).toContain("Completed: CLI Argument Parsing Boundary Cleanup");
    expect(executionBreakdown).toContain("Completed: Internal Network Access Rule Family");
    expect(executionBreakdown).toContain("Current Slice 3: Policy Ergonomics From Real Feedback");
    expect(executionBreakdown).not.toContain("Current Slice 1: Rule Metadata Consumer Examples");
    expect(executionBreakdown).not.toContain("Current Slice 2: Release And Reference-Target Guardrail Tightening");
  });

  it("keeps the publish checklist aligned with the current full release gate", async () => {
    const publishChecklist = await readFile(publishChecklistPath, "utf8");

    expect(publishChecklist).toContain("npm run release:check");
    expect(publishChecklist).toContain("If you only need the packaging-oriented subset, run:");
    expect(publishChecklist).toContain("release gate chooser");
    expect(publishChecklist).toContain("`release:check` does not replay live public reference-target scans");
    expect(publishChecklist).toContain("choose the right gate from the release gate chooser");
    expect(publishChecklist).toContain("use `npm run release:check:strict` when release notes or public examples claim current live reference-target confidence");
  });

  it("keeps release gate selection explicit for maintainers", async () => {
    const readme = await readFile(readmePath, "utf8");
    const contributorTaskMap = await readFile(contributorTaskMapPath, "utf8");
    const releaseConfidence = await readFile(releaseConfidencePath, "utf8");

    expect(readme).toContain("release-confidence-and-reference-targets.md#release-gate-chooser");
    expect(contributorTaskMap).toContain("release gate chooser");
    expect(releaseConfidence).toContain("## Release gate chooser");
    expect(releaseConfidence).toContain("Docs-only wording or navigation");
    expect(releaseConfidence).toContain("Packaging or install-path changes");
    expect(releaseConfidence).toContain("This checks tarball/install readiness, not live scanner credibility.");
    expect(releaseConfidence).toContain("Rule, finding, baseline, JSON, Action, or SARIF changes");
    expect(releaseConfidence).toContain("`fixtures/reference-targets.json` changes");
    expect(releaseConfidence).toContain("Final public release candidate");
    expect(releaseConfidence).toContain("`npm run release:check:strict` is the only bundled gate");
    expect(releaseConfidence).toContain("do not imply live reference targets were replayed");
    expect(releaseConfidence).toContain("update `fixtures/reference-targets.json`, this checked-in target list, and any release notes or public examples");
  });

  it("keeps reference target docs aligned with the manifest", async () => {
    const releaseConfidence = await readFile(releaseConfidencePath, "utf8");
    const manifest = JSON.parse(await readFile(referenceTargetsPath, "utf8")) as {
      targets: Array<{ target: string }>;
    };

    for (const target of manifest.targets) {
      const targetUrl = new URL(target.target);
      const documentedRoot = `${targetUrl.origin}${targetUrl.pathname}`;
      expect(releaseConfidence).toContain(documentedRoot);
    }
  });

  it("keeps install guidance aligned with current source-checkout release gates", async () => {
    const installing = await readFile(installingPath, "utf8");

    expect(installing).toContain("npm run reference:check");
    expect(installing).toContain("npm run reference:scan");
    expect(installing).toContain("npm run release:check");
    expect(installing).toContain("Those commands are source-checkout release-confidence gates, not install commands.");
  });

  it("keeps release-version examples aligned with the current next public tag", async () => {
    const contributing = await readFile(contributingPath, "utf8");
    const readme = await readFile(readmePath, "utf8");

    expect(contributing).toContain("provide a tag like `v0.2.0`");
    expect(readme).toContain("0.2.0-dev");
    expect(readme).toContain("before running the manual GitHub release workflow for the next public tag");
  });
});
