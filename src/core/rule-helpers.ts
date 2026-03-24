import type { Confidence, Finding, ScanFile, Severity } from "./types.js";

const SEVERITY_ORDER: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2
};

const CONFIDENCE_ORDER: Record<Confidence, number> = {
  high: 0,
  medium: 1,
  low: 2
};

export function normalizeEvidence(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function snippetFrom(file: ScanFile, lineIndex: number, extraLines = 0): string {
  const endLine = Math.min(file.lines.length, lineIndex + extraLines + 1);
  return normalizeEvidence(file.lines.slice(lineIndex, endLine).join(" "));
}

export function createFinding(input: {
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  file: string;
  line?: number;
  evidence: string;
  whyItMatters: string;
  remediation: string;
}): Finding {
  const finding: Finding = {
    ruleId: input.ruleId,
    severity: input.severity,
    confidence: input.confidence,
    title: input.title,
    file: input.file,
    evidence: normalizeEvidence(input.evidence),
    whyItMatters: input.whyItMatters,
    remediation: input.remediation
  };

  if (input.line !== undefined) {
    finding.line = input.line;
  }

  return finding;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((left, right) => {
    const severityDifference = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
    if (severityDifference !== 0) {
      return severityDifference;
    }

    const confidenceDifference = CONFIDENCE_ORDER[left.confidence] - CONFIDENCE_ORDER[right.confidence];
    if (confidenceDifference !== 0) {
      return confidenceDifference;
    }

    const ruleDifference = left.ruleId.localeCompare(right.ruleId);
    if (ruleDifference !== 0) {
      return ruleDifference;
    }

    const fileDifference = left.file.localeCompare(right.file);
    if (fileDifference !== 0) {
      return fileDifference;
    }

    return (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER);
  });
}

export function looksLikeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isImportPresent(file: ScanFile, modules: string[]): boolean {
  return modules.some((moduleName) => {
    const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(?:from\\s+["']${escaped}["']|require\\(["']${escaped}["']\\))`
    );
    return pattern.test(file.content);
  });
}
