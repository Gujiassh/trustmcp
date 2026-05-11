import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const TOOL_DESCRIPTION_PATTERN =
  /\b(?:description|title|summary)\s*:\s*["'`][^"'`]*(?:execute commands?|shell|terminal|run scripts?|download and run|read secrets?|read credentials?|access \.aws|access ssh|exfiltrate|send to remote)[^"'`]*["'`]/i;

export const toolMetadataRiskRule: Rule = {
  confidenceGuidance: [
    {
      level: "medium",
      reason: "metadata-advertises-risky-capability",
      description: "Tool metadata text directly advertises risky host capabilities such as shell, secrets, or remote exfiltration."
    }
  ],
  confidenceLevels: ["medium"],
  confidenceReasons: ["metadata-advertises-risky-capability"],
  defaultSeverity: "medium",
  id: "mcp/tool-metadata-risk",
  title: "Risky MCP tool capability advertised in metadata",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      file.lines.forEach((line, index) => {
        if (!TOOL_DESCRIPTION_PATTERN.test(line)) {
          return;
        }

        const evidence = snippetFrom(file, index, 1);

        findings.push(
          createFinding({
            ruleId: "mcp/tool-metadata-risk",
            severity: "medium",
            confidence: "medium",
            confidenceReason: "metadata-advertises-risky-capability",
            title: toolMetadataRiskRule.title,
            file: file.relativePath,
            line: index + 1,
            evidence,
            whyItMatters:
              "Tool descriptions that explicitly advertise high-risk host capabilities can be a strong trust signal even before reviewers inspect the implementation in detail.",
            remediation:
              "Keep tool metadata narrow and honest, avoid advertising broad host access casually, and ensure any high-risk capability claims match explicit review and gating expectations."
          })
        );
      });
    }

    return findings;
  }
};
