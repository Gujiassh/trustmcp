import type { BaselineEntry, Finding } from "./types.js";

export function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function normalizeFingerprint(fingerprint: string): string {
  const [ruleId = "", file = "", ...rest] = fingerprint.split("|");
  const evidence = rest.join("|");
  return `${ruleId}|${normalizeRelativePath(file)}|${evidence}`;
}

export function buildBaselineKey(ruleId: string, filePath: string, line?: number): string {
  const normalizedFile = normalizeRelativePath(filePath);
  const linePart = line === undefined ? "" : line.toString();
  return `${ruleId}|${normalizedFile}|${linePart}`;
}

export function findingsToBaselineEntries(findings: Finding[]): BaselineEntry[] {
  return findings.map((finding) =>
    normalizeBaselineEntry({
      fingerprint: finding.fingerprint,
      ruleId: finding.ruleId,
      file: finding.file,
      ...(finding.line === undefined ? {} : { line: finding.line })
    })
  );
}

export function normalizeBaselineEntry(entry: BaselineEntry): BaselineEntry {
  return {
    ...(entry.fingerprint === undefined ? {} : { fingerprint: normalizeFingerprint(entry.fingerprint) }),
    ruleId: entry.ruleId,
    file: normalizeRelativePath(entry.file),
    ...(entry.line === undefined ? {} : { line: entry.line })
  };
}
