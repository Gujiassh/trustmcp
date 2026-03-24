import type { AuditReport } from "../core/types.js";

import { renderJsonReport } from "./json.js";
import { renderMarkdownReport } from "./markdown.js";
import { renderSummaryReport as renderCompactSummaryReport } from "./summary.js";
import { renderTextReport } from "./text.js";

export type OutputFormat = "json" | "markdown" | "text";

export function isOutputFormat(value: string | undefined): value is OutputFormat {
  return value === "json" || value === "markdown" || value === "text";
}

export function renderReport(report: AuditReport, format: OutputFormat): string {
  if (format === "json") {
    return renderJsonReport(report);
  }

  if (format === "markdown") {
    return renderMarkdownReport(report);
  }

  return renderTextReport(report);
}

export function renderSummaryReport(report: AuditReport, format: OutputFormat): string {
  return renderCompactSummaryReport(report, format);
}
