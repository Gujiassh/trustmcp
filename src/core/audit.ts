import { collectSourceFiles } from "./source-files.js";
import { looksLikeUrl, sortFindings } from "./rule-helpers.js";
import type { AuditReport, AuditOptions, BaselineEntry, Finding, MaterializedSource } from "./types.js";
import { TRUSTMCP_VERSION } from "./version.js";
import {
  getUnsupportedGitHubUrlMessage,
  materializeGitHubRepository,
  parseGitHubRepositoryUrl
} from "../inputs/github.js";
import { materializeLocalDirectory } from "../inputs/local.js";
import { runAllRules } from "../rules/index.js";
import { buildBaselineKey, normalizeRelativePath } from "./baseline-entries.js";

export interface AuditDependencies {
  collectSourceFiles: typeof collectSourceFiles;
  materializeLocalDirectory: typeof materializeLocalDirectory;
  materializeGitHubRepository: typeof materializeGitHubRepository;
}

const DEFAULT_LIMITATIONS = [
  "Static heuristics only.",
  "TrustMCP does not execute the target.",
  "No finding set should be interpreted as a safety guarantee."
];

export async function auditTarget(
  targetInput: string,
  optionsOrOverrides?: AuditOptions | Partial<AuditDependencies>,
  overrides: Partial<AuditDependencies> = {}
): Promise<AuditReport> {
  const { options, overrides: dependencyOverrides } = resolveAuditArguments(optionsOrOverrides, overrides);
  const dependencies: AuditDependencies = {
    collectSourceFiles,
    materializeLocalDirectory,
    materializeGitHubRepository,
    ...dependencyOverrides
  };

  const materializedSource = await materializeTarget(targetInput, dependencies);

  try {
    const files = await dependencies.collectSourceFiles(materializedSource.rootDir);
    const findings = sortFindings(runAllRules(files));
    const filteredFindings = applyIgnoreFilters(findings, options);
    const newFindings = applyBaselineFilter(filteredFindings, options.baselineEntries);
    const baselineApplied = options.baselineEntries !== undefined && options.baselineEntries.length > 0;
    return createReport(materializedSource, filteredFindings, newFindings, baselineApplied);
  } finally {
    if (materializedSource.cleanup !== undefined) {
      await materializedSource.cleanup();
    }
  }
}

async function materializeTarget(
  targetInput: string,
  dependencies: AuditDependencies
): Promise<MaterializedSource> {
  if (parseGitHubRepositoryUrl(targetInput) !== null) {
    return dependencies.materializeGitHubRepository(targetInput);
  }

  const unsupportedGitHubUrlMessage = getUnsupportedGitHubUrlMessage(targetInput);
  if (unsupportedGitHubUrlMessage !== null) {
    throw new Error(unsupportedGitHubUrlMessage);
  }

  if (looksLikeUrl(targetInput)) {
    throw new Error("Unsupported URL. TrustMCP accepts local directories or public GitHub repository URLs.");
  }

  return dependencies.materializeLocalDirectory(targetInput);
}

function createReport(
  materializedSource: MaterializedSource,
  findings: Finding[],
  newFindings: Finding[],
  baselineApplied: boolean
): AuditReport {
  const triggeredRuleCount = new Set(findings.map((finding) => finding.ruleId)).size;
  const severityCounts = countFindingsBySeverity(findings);
  const newSeverityCounts = countFindingsBySeverity(newFindings);
  const newTriggeredRuleCount = new Set(newFindings.map((finding) => finding.ruleId)).size;
  const baseMessage =
    findings.length === 0
      ? "No matching rules were triggered. Static heuristics only; this does not mean the target is safe."
      : `${findings.length} finding(s) across ${triggeredRuleCount} rule(s). Static heuristics only.`;
  const newMessage =
    newFindings.length === 0
      ? "No new findings."
      : `${newFindings.length} new finding(s) across ${newTriggeredRuleCount} rule(s).`;
  const summaryMessage = baselineApplied ? `${baseMessage} ${newMessage}` : baseMessage;

  return {
    tool: {
      name: "TrustMCP",
      version: TRUSTMCP_VERSION
    },
    target: materializedSource.target,
    limitations: DEFAULT_LIMITATIONS,
    summary: {
      newFindingCount: newFindings.length,
      newTriggeredRuleCount,
      newSeverityCounts,
      findingCount: findings.length,
      triggeredRuleCount,
      severityCounts,
      message: summaryMessage
    },
    findings,
    newFindings
  };
}

function countFindingsBySeverity(findings: Finding[]): AuditReport["summary"]["severityCounts"] {
  const severityCounts = {
    low: 0,
    medium: 0,
    high: 0
  };

  for (const finding of findings) {
    severityCounts[finding.severity] += 1;
  }

  return severityCounts;
}

function applyIgnoreFilters(findings: Finding[], options: AuditOptions): Finding[] {
  const { ignoreRules = [], ignorePaths = [] } = options;
  if (ignoreRules.length === 0 && ignorePaths.length === 0) {
    return findings;
  }

  const ruleSet = new Set(ignoreRules);
  const matchers = buildPathMatchers(ignorePaths);

  return findings.filter((finding) => {
    if (ruleSet.has(finding.ruleId)) {
      return false;
    }

    if (matchers.length === 0) {
      return true;
    }

    const relativePath = normalizeRelativePath(finding.file);
    if (matchers.some((matcher) => matcher(relativePath))) {
      return false;
    }

    return true;
  });
}

function buildPathMatchers(patterns: string[]): ((relativePath: string) => boolean)[] {
  return patterns.map((pattern) => {
    const normalizedPattern = normalizeRelativePath(pattern).replace(/\/+$/, "");
    return (relativePath: string) =>
      relativePath === normalizedPattern || relativePath.startsWith(`${normalizedPattern}/`);
  });
}

function applyBaselineFilter(findings: Finding[], baselineEntries?: BaselineEntry[]): Finding[] {
  if (baselineEntries === undefined || baselineEntries.length === 0) {
    return findings;
  }

  const baselineSet = new Set(
    baselineEntries.map((entry) => buildBaselineKey(entry.ruleId, entry.file, entry.line))
  );

  return findings.filter(
    (finding) => !baselineSet.has(buildBaselineKey(finding.ruleId, finding.file, finding.line))
  );
}

function resolveAuditArguments(
  optionsOrOverrides?: AuditOptions | Partial<AuditDependencies>,
  overrides: Partial<AuditDependencies> = {}
): { options: AuditOptions; overrides: Partial<AuditDependencies> } {
  if (optionsOrOverrides === undefined) {
    return { options: {}, overrides };
  }

  if (isAuditDependenciesOverride(optionsOrOverrides)) {
    return {
      options: {},
      overrides: {
        ...overrides,
        ...optionsOrOverrides
      }
    };
  }

  return { options: optionsOrOverrides, overrides };
}

function isAuditDependenciesOverride(
  value: AuditOptions | Partial<AuditDependencies>
): value is Partial<AuditDependencies> {
  return (
    "collectSourceFiles" in value ||
    "materializeLocalDirectory" in value ||
    "materializeGitHubRepository" in value
  );
}
