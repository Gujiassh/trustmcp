import type { AuditReport } from "../core/types.js";

export function renderJsonReport(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}
