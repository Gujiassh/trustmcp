import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { auditTarget } from "../src/core/audit.js";
import { renderJsonReport } from "../src/renderers/json.js";
import { renderTextReport } from "../src/renderers/text.js";

const localRiskyFixture = fileURLToPath(new URL("../fixtures/local-risky", import.meta.url));
const localCleanFixture = fileURLToPath(new URL("../fixtures/local-clean", import.meta.url));

describe("renderers", () => {
  it("renders stable JSON output", async () => {
    const first = renderJsonReport(await auditTarget(localRiskyFixture));
    const second = renderJsonReport(await auditTarget(localRiskyFixture));
    const parsed = JSON.parse(first) as {
      summary: { findingCount: number };
      findings: Array<{ ruleId: string }>;
    };

    expect(first).toBe(second);
    expect(parsed.summary.findingCount).toBe(3);
    expect(parsed.findings[0]?.ruleId).toBe("mcp/broad-filesystem");
  });

  it("renders the no-match text without claiming safety", async () => {
    const report = await auditTarget(localCleanFixture);
    const rendered = renderTextReport(report);

    expect(rendered).toContain("No matching rules were triggered.");
    expect(rendered).toContain("does not mean the target is safe");
  });
});
