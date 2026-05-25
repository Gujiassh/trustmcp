import { readFile } from "node:fs/promises";

import type { AuditReport } from "../core/types.js";

export type ReferenceTargetCategory = "finding-producing" | "mostly-clean" | "sarif-relevant";

export interface ReferenceTargetEntry {
  id: string;
  target: string;
  expectedCategory: ReferenceTargetCategory;
  notes: string;
}

export interface ReferenceTargetManifest {
  targets: ReferenceTargetEntry[];
}

export type ReferenceTargetScanResult = ReferenceTargetScanSuccess | ReferenceTargetScanFailure;

export interface ReferenceTargetScanSuccess {
  id: string;
  target: string;
  expectedCategory: ReferenceTargetCategory;
  displayName: string;
  resolvedRef?: string;
  findingCount: number;
  ruleCount: number;
  summaryMessage: string;
}

export interface ReferenceTargetScanFailure {
  id: string;
  target: string;
  expectedCategory: ReferenceTargetCategory;
  errorMessage: string;
}

export interface ReferenceTargetExpectationCheck {
  ok: boolean;
  failures: string[];
}

export interface ReferenceTargetScanPayload {
  ok: boolean;
  failures: string[];
  targets: ReferenceTargetScanResult[];
}

const ALLOWED_CATEGORIES = new Set<ReferenceTargetCategory>([
  "finding-producing",
  "mostly-clean",
  "sarif-relevant"
]);

export async function loadReferenceTargetManifest(manifestPath: string): Promise<ReferenceTargetManifest> {
  const raw = await readFile(manifestPath, "utf8");
  return validateReferenceTargetManifest(JSON.parse(raw));
}

export function validateReferenceTargetManifest(value: unknown): ReferenceTargetManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Reference target manifest must be a JSON object.");
  }

  const candidate = value as { targets?: unknown };
  if (!Array.isArray(candidate.targets) || candidate.targets.length === 0) {
    throw new Error("Reference target manifest must include a non-empty targets array.");
  }

  return {
    targets: candidate.targets.map((entry, index) => validateReferenceTargetEntry(entry, index))
  };
}

export async function scanReferenceTargets(
  targets: ReferenceTargetEntry[],
  auditTarget: (target: string) => Promise<AuditReport>
): Promise<ReferenceTargetScanResult[]> {
  const results: ReferenceTargetScanResult[] = [];

  for (const target of targets) {
    try {
      const report = await auditTarget(target.target);
      results.push({
        id: target.id,
        target: target.target,
        expectedCategory: target.expectedCategory,
        displayName: report.target.displayName,
        ...(report.target.resolvedRef === undefined ? {} : { resolvedRef: report.target.resolvedRef }),
        findingCount: report.summary.findingCount,
        ruleCount: report.summary.triggeredRuleCount,
        summaryMessage: report.summary.message
      });
    } catch (error) {
      results.push({
        id: target.id,
        target: target.target,
        expectedCategory: target.expectedCategory,
        errorMessage: normalizeErrorMessage(error)
      });
    }
  }

  return results;
}

export function validateReferenceTargetExpectations(
  results: ReferenceTargetScanResult[]
): ReferenceTargetExpectationCheck {
  const failures: string[] = [];

  for (const result of results) {
    if (isReferenceTargetScanFailure(result)) {
      failures.push(`${result.id} failed to scan: ${result.errorMessage}`);
      continue;
    }

    if (result.expectedCategory === "finding-producing" && result.findingCount === 0) {
      failures.push(`${result.id} expected findings but reported none.`);
    }

    if (result.expectedCategory === "mostly-clean" && result.findingCount !== 0) {
      failures.push(`${result.id} expected a mostly-clean/no-match result but reported ${result.findingCount} finding(s).`);
    }

    if (result.expectedCategory === "sarif-relevant" && result.ruleCount === 0 && result.findingCount === 0) {
      failures.push(`${result.id} expected a meaningful SARIF inspection target but reported no findings and no triggered rules.`);
    }
  }

  return {
    ok: failures.length === 0,
    failures
  };
}

export function renderReferenceTargetManifestText(manifest: ReferenceTargetManifest): string {
  const lines = ["Reference target manifest OK"];

  for (const target of manifest.targets) {
    lines.push(`- ${target.id}: ${target.expectedCategory} -> ${target.target}`);
  }

  return lines.join("\n");
}

export function renderReferenceTargetManifestJson(manifest: ReferenceTargetManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function renderReferenceTargetScanText(
  payload: ReferenceTargetScanPayload
): { stdout: string; stderr: string[] } {
  const lines = [`Reference target scan run ${payload.ok ? "OK" : "FAILED"}`];

  for (const result of payload.targets) {
    if (isReferenceTargetScanFailure(result)) {
      lines.push(`- ${result.id}: ${result.expectedCategory} -> ${result.target} (scan failed: ${result.errorMessage})`);
      continue;
    }

    lines.push(
      `- ${result.id}: ${result.expectedCategory} -> ${result.displayName}` +
      `${result.resolvedRef === undefined ? "" : ` @ ${result.resolvedRef}`}` +
      ` (${result.findingCount} finding(s), ${result.ruleCount} rule(s))`
    );
  }

  return {
    stdout: lines.join("\n"),
    stderr: payload.failures.map((failure) => `reference-targets failed: ${failure}`)
  };
}

export function renderReferenceTargetScanJson(payload: ReferenceTargetScanPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function buildReferenceTargetScanPayload(
  results: ReferenceTargetScanResult[]
): ReferenceTargetScanPayload {
  const expectationCheck = validateReferenceTargetExpectations(results);
  return {
    ok: expectationCheck.ok,
    failures: expectationCheck.failures,
    targets: results
  };
}

function validateReferenceTargetEntry(value: unknown, index: number): ReferenceTargetEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Reference target at index ${index} must be an object.`);
  }

  const candidate = value as {
    id?: unknown;
    target?: unknown;
    expectedCategory?: unknown;
    notes?: unknown;
  };

  if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
    throw new Error(`Reference target at index ${index} has invalid id.`);
  }

  if (typeof candidate.target !== "string" || !candidate.target.startsWith("https://github.com/")) {
    throw new Error(`Reference target '${candidate.id}' must use a GitHub repository root URL.`);
  }

  if (
    typeof candidate.expectedCategory !== "string" ||
    !ALLOWED_CATEGORIES.has(candidate.expectedCategory as ReferenceTargetCategory)
  ) {
    throw new Error(`Reference target '${candidate.id}' has invalid expectedCategory.`);
  }

  if (typeof candidate.notes !== "string" || candidate.notes.trim().length === 0) {
    throw new Error(`Reference target '${candidate.id}' must include notes.`);
  }

  return {
    id: candidate.id.trim(),
    target: candidate.target.trim(),
    expectedCategory: candidate.expectedCategory as ReferenceTargetCategory,
    notes: candidate.notes.trim()
  };
}

function isReferenceTargetScanFailure(result: ReferenceTargetScanResult): result is ReferenceTargetScanFailure {
  return "errorMessage" in result;
}

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
