import type { AuditReport, Finding } from "../core/types.js";
import { listRules } from "../rules/index.js";

const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
const SARIF_VERSION = "2.1.0";

export function renderSarifReport(report: AuditReport): string {
  const newFindingFingerprints = new Set(report.newFindings.map((finding) => finding.fingerprint));
  const baselineApplied = report.summary.baselineApplied;

  return JSON.stringify(
    {
      $schema: SARIF_SCHEMA,
      version: SARIF_VERSION,
      runs: [
        {
          tool: {
            driver: {
              name: report.tool.name,
              version: report.tool.version,
              informationUri: "https://github.com/Gujiassh/trustmcp",
              rules: buildSarifRules(report.findings)
            }
          },
          results: report.findings.map((finding) => buildSarifResult(finding, {
            baselineApplied,
            isNewFinding: newFindingFingerprints.has(finding.fingerprint)
          }))
        }
      ]
    },
    null,
    2
  );
}

function buildSarifRules(findings: Finding[]) {
  const rulesById = new Map<string, Finding>();
  const listedRules = new Map(listRules().map((rule) => [rule.id, rule]));

  for (const finding of findings) {
    if (!rulesById.has(finding.ruleId)) {
      rulesById.set(finding.ruleId, finding);
    }
  }

  return [...rulesById.entries()]
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([, finding]) => {
      const listedRule = listedRules.get(finding.ruleId);
      return {
      id: finding.ruleId,
      shortDescription: {
        text: finding.title
      },
      fullDescription: {
        text: finding.whyItMatters
      },
      defaultConfiguration: {
        level: toSarifLevel(finding.severity)
      },
      help: {
        text: finding.remediation
      },
      properties: {
        ruleId: finding.ruleId,
        confidence: finding.confidence,
        severity: finding.severity,
        ...(listedRule?.confidenceLevels === undefined ? {} : { confidenceLevels: listedRule.confidenceLevels }),
        ...(listedRule?.confidenceReasons === undefined ? {} : { confidenceReasons: listedRule.confidenceReasons }),
        ...(listedRule?.confidenceGuidance === undefined ? {} : { confidenceGuidance: listedRule.confidenceGuidance })
      }
    };});
}

function buildSarifResult(
  finding: Finding,
  options: {
    baselineApplied: boolean;
    isNewFinding: boolean;
  }
) {
  const result = {
    ruleId: finding.ruleId,
    level: toSarifLevel(finding.severity),
    message: {
      text: finding.title
    },
    partialFingerprints: {
      primaryLocationLineHash: finding.fingerprint
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: finding.file
          },
          region: finding.line === undefined ? undefined : { startLine: finding.line }
        }
      }
    ],
    properties: {
      fingerprint: finding.fingerprint,
      baselineApplied: options.baselineApplied,
      isNewFinding: options.isNewFinding,
      isGatedFinding: options.baselineApplied ? options.isNewFinding : true,
      confidence: finding.confidence,
      ...(finding.confidenceReason === undefined ? {} : { confidenceReason: finding.confidenceReason }),
      severity: finding.severity,
      evidence: finding.evidence,
      whyItMatters: finding.whyItMatters,
      remediation: finding.remediation
    }
  };

  return finding.line === undefined
    ? {
        ...result,
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: finding.file
              }
            }
          }
        ]
      }
    : result;
}

function toSarifLevel(severity: Finding["severity"]): "error" | "note" | "warning" {
  if (severity === "high") {
    return "error";
  }

  if (severity === "medium") {
    return "warning";
  }

  return "note";
}
