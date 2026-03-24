import type { AuditReport, Finding } from "../core/types.js";

export function renderTextReport(report: AuditReport): string {
  const lines = [
    `TrustMCP v${report.tool.version}`,
    `Target: ${report.target.displayName}`,
    `Source: ${report.target.sourceType}`
  ];

  if (report.target.resolvedRef !== undefined) {
    lines.push(`Ref: ${report.target.resolvedRef}`);
  }

  lines.push(`Summary: ${report.summary.message}`);

  if (report.findings.length === 0) {
    return lines.join("\n");
  }

  for (const finding of report.findings) {
    lines.push("");
    lines.push(`[${finding.severity.toUpperCase()}][${finding.confidence.toUpperCase()}] ${finding.title}`);
    lines.push(`Rule: ${finding.ruleId}`);
    lines.push(`Location: ${formatLocation(finding)}`);
    lines.push(`Evidence: ${finding.evidence}`);
    lines.push(`Why it matters: ${finding.whyItMatters}`);
    lines.push(`Remediation: ${finding.remediation}`);
  }

  return lines.join("\n");
}

function formatLocation(finding: Finding): string {
  if (finding.line === undefined) {
    return finding.file;
  }

  return `${finding.file}:${finding.line}`;
}
