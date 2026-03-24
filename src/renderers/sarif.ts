import type { AuditReport, Finding } from "../core/types.js";

const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
const SARIF_VERSION = "2.1.0";

export function renderSarifReport(report: AuditReport): string {
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
          results: report.findings.map((finding) => buildSarifResult(finding))
        }
      ]
    },
    null,
    2
  );
}

function buildSarifRules(findings: Finding[]) {
  const rulesById = new Map<string, Finding>();

  for (const finding of findings) {
    if (!rulesById.has(finding.ruleId)) {
      rulesById.set(finding.ruleId, finding);
    }
  }

  return [...rulesById.entries()]
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([, finding]) => ({
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
        confidence: finding.confidence,
        severity: finding.severity
      }
    }));
}

function buildSarifResult(finding: Finding) {
  const result = {
    ruleId: finding.ruleId,
    level: toSarifLevel(finding.severity),
    message: {
      text: finding.title
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
      confidence: finding.confidence,
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
