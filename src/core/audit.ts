import { collectSourceFiles } from "./source-files.js";
import { looksLikeUrl, sortFindings } from "./rule-helpers.js";
import type { AuditReport, Finding, MaterializedSource } from "./types.js";
import { TRUSTMCP_VERSION } from "./version.js";
import { materializeGitHubRepository, parseGitHubRepositoryUrl } from "../inputs/github.js";
import { materializeLocalDirectory } from "../inputs/local.js";
import { runAllRules } from "../rules/index.js";

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
  overrides: Partial<AuditDependencies> = {}
): Promise<AuditReport> {
  const dependencies: AuditDependencies = {
    collectSourceFiles,
    materializeLocalDirectory,
    materializeGitHubRepository,
    ...overrides
  };

  const materializedSource = await materializeTarget(targetInput, dependencies);

  try {
    const files = await dependencies.collectSourceFiles(materializedSource.rootDir);
    const findings = sortFindings(runAllRules(files));
    return createReport(materializedSource, findings);
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

  if (looksLikeUrl(targetInput)) {
    throw new Error("Unsupported URL. TrustMCP accepts local directories or public GitHub repository URLs.");
  }

  return dependencies.materializeLocalDirectory(targetInput);
}

function createReport(materializedSource: MaterializedSource, findings: Finding[]): AuditReport {
  const triggeredRuleCount = new Set(findings.map((finding) => finding.ruleId)).size;
  const summaryMessage =
    findings.length === 0
      ? "No matching rules were triggered. Static heuristics only; this does not mean the target is safe."
      : `${findings.length} finding(s) across ${triggeredRuleCount} rule(s). Static heuristics only.`;

  return {
    tool: {
      name: "TrustMCP",
      version: TRUSTMCP_VERSION
    },
    target: materializedSource.target,
    limitations: DEFAULT_LIMITATIONS,
    summary: {
      findingCount: findings.length,
      triggeredRuleCount,
      message: summaryMessage
    },
    findings
  };
}
