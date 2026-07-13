import type { AuditCoverage, SkippedSourceFile } from "../core/types.js";

export function formatCoverageSummary(coverage: AuditCoverage): string {
  return coverage.complete
    ? `complete (${coverage.scannedFileCount} file(s) scanned)`
    : `incomplete (${coverage.scannedFileCount} file(s) scanned, ${coverage.skippedFileCount} skipped)`;
}

export function formatSkippedFile(file: SkippedSourceFile): string {
  return `${file.relativePath} (${file.reason}, ${file.sizeBytes} bytes)`;
}
