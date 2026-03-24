import type { AuditReport, Severity } from "./types.js";

const SEVERITY_LEVELS: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2
};

export function shouldFailForThreshold(report: AuditReport, failOn?: Severity): boolean {
  if (failOn === undefined) {
    return false;
  }

  const thresholdLevel = SEVERITY_LEVELS[failOn];
  return report.findings.some((finding) => SEVERITY_LEVELS[finding.severity] >= thresholdLevel);
}

export function isSeverity(value: string | undefined): value is Severity {
  return value === "low" || value === "medium" || value === "high";
}
