import type { AuditReport, Finding } from "../core/types.js";

export function renderMarkdownReport(report: AuditReport): string {
  const lines = [
    "# TrustMCP Report",
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
  lines.push("");
  lines.push("## Findings");
  lines.push("");

  if (report.findings.length === 0) {
    lines.push("No matching rules were triggered.");
    return lines.join("\n");
  }

  for (const [index, finding] of report.findings.entries()) {
    lines.push(`### ${index + 1}. ${finding.title}`);
    lines.push(`- Rule: \`${finding.ruleId}\``);
    lines.push(`- Severity: \`${finding.severity}\``);
    lines.push(`- Confidence: \`${finding.confidence}\``);
    lines.push(`- Location: \`${formatLocation(finding)}\``);
    lines.push(`- Evidence: ${finding.evidence}`);
    lines.push(`- Why it matters: ${finding.whyItMatters}`);
    lines.push(`- Remediation: ${finding.remediation}`);

    if (index < report.findings.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n");
}

function formatLocation(finding: Finding): string {
  if (finding.line === undefined) {
    return finding.file;
  }

  return `${finding.file}:${finding.line}`;
}
