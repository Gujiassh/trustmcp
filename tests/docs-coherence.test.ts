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

describe("docs coherence", () => {
  it("keeps the public scanner-surface docs aligned with the twelve-rule baseline", async () => {
    const whatScans = await readFile(whatScansPath, "utf8");
    const troubleshooting = await readFile(troubleshootingPath, "utf8");

    expect(whatScans).toContain("TrustMCP currently ships twelve static rules");
    expect(troubleshooting).toContain("TrustMCP currently ships twelve rules.");
  });

  it("keeps machine-readable rule metadata entry points visible in user-facing docs", async () => {
    const readme = await readFile(readmePath, "utf8");
    const whatScans = await readFile(whatScansPath, "utf8");
    const troubleshooting = await readFile(troubleshootingPath, "utf8");

    expect(readme).toContain("node dist/cli/main.js list-rules --json");
    expect(readme).toContain("confidenceLevels");
    expect(readme).toContain("confidenceGuidance");
    expect(whatScans).toContain("node dist/cli/main.js list-rules --json");
    expect(troubleshooting).toContain("node dist/cli/main.js list-rules --json");
  });

  it("keeps internal roadmap docs from drifting back to the original three-rule baseline", async () => {
    const longTermSpec = await readFile(longTermSpecPath, "utf8");
    const executionBreakdown = await readFile(executionBreakdownPath, "utf8");

    expect(longTermSpec).not.toContain("three capability-focused rules");
    expect(executionBreakdown).toContain("Finish refreshing roadmap and public docs so they no longer describe the original three-rule baseline.");
  });

  it("keeps the publish checklist aligned with the current full release gate", async () => {
    const publishChecklist = await readFile(publishChecklistPath, "utf8");

    expect(publishChecklist).toContain("npm run release:check");
    expect(publishChecklist).toContain("If you only need the packaging-oriented subset, run:");
  });

  it("keeps install guidance aligned with current source-checkout release gates", async () => {
    const installing = await readFile(installingPath, "utf8");

    expect(installing).toContain("npm run reference:check");
    expect(installing).toContain("npm run reference:scan");
    expect(installing).toContain("npm run release:check");
    expect(installing).toContain("Those commands are source-checkout release-confidence gates, not install commands.");
  });
});
