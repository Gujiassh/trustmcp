import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const ARCHIVE_PATTERN =
  /\bAdmZip\s*\(|\bextractAllTo\s*\(|\bunzip\s*\(|\btar\.(?:x|extract)\s*\(|\bdecompress\s*\(/;

const USER_CONTROLLED_ARCHIVE_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:zip|archive|tar|file|path|target)\b/i;

export const archiveExtractRule: Rule = {
  confidenceGuidance: [
    {
      level: "medium",
      reason: "fixed-archive-extraction",
      description: "An archive extraction helper was matched without clear tool-controlled archive or target input."
    },
    {
      level: "high",
      reason: "tool-controlled-archive-path",
      description: "The archive source or extraction target appears to come from tool or request input."
    }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: ["fixed-archive-extraction", "tool-controlled-archive-path"],
  defaultSeverity: "medium",
  id: "mcp/archive-extract",
  title: "Archive extraction capability detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      file.lines.forEach((line, index) => {
        if (!ARCHIVE_PATTERN.test(line)) {
          return;
        }

        const evidence = snippetFrom(file, index, 2);
        const confidence = USER_CONTROLLED_ARCHIVE_PATTERN.test(evidence) ? "high" : "medium";
        const confidenceReason = USER_CONTROLLED_ARCHIVE_PATTERN.test(evidence)
          ? "tool-controlled-archive-path"
          : "fixed-archive-extraction";

        findings.push(
          createFinding({
            ruleId: "mcp/archive-extract",
            severity: "medium",
            confidence,
            confidenceReason,
            title: archiveExtractRule.title,
            file: file.relativePath,
            line: index + 1,
            evidence,
            whyItMatters:
              "Extracting archives can unpack attacker-controlled file trees onto the host, which may combine with path traversal, overwrite, or later execution flows.",
            remediation:
              "Constrain archive extraction to explicit safe directories, validate archive provenance and contents, and avoid unpacking tool-controlled archives into general host paths."
          })
        );
      });
    }

    return findings;
  }
};
