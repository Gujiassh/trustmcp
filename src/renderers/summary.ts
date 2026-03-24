import type { AuditReport } from "../core/types.js";

export function renderSummaryReport(report: AuditReport, format: "json" | "markdown" | "text"): string {
  if (format === "json") {
    return JSON.stringify(
      {
        tool: report.tool,
        target: report.target,
        summary: report.summary
      },
      null,
      2
    );
  }

  if (format === "markdown") {
    const lines = [
      "# TrustMCP Summary",
      "",
      `- Target: \`${report.target.displayName}\``,
      `- Source: \`${report.target.sourceType}\``
    ];

    if (report.target.resolvedRef !== undefined) {
      lines.push(`- Ref: \`${report.target.resolvedRef}\``);
    }

    lines.push(`- Findings: ${report.summary.findingCount}`);
    lines.push(`- Rules triggered: ${report.summary.triggeredRuleCount}`);
    lines.push(
      `- Severity counts: low ${report.summary.severityCounts.low}, medium ${report.summary.severityCounts.medium}, high ${report.summary.severityCounts.high}`
    );
    lines.push(`- Summary: ${report.summary.message}`);

    return lines.join("\n");
  }

  const lines = [
    `TrustMCP v${report.tool.version}`,
    `Target: ${report.target.displayName}`,
    `Source: ${report.target.sourceType}`
  ];

  if (report.target.resolvedRef !== undefined) {
    lines.push(`Ref: ${report.target.resolvedRef}`);
  }

  lines.push(`Summary: ${report.summary.message}`);
  return lines.join("\n");
}
