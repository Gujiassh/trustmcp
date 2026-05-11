import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const FS_IMPORT_PATTERN =
  /(?:from\s+["']node:fs["']|from\s+["']fs["']|require\(["']node:fs["']\)|require\(["']fs["']\))/;

const QUALIFIED_FILESYSTEM_CALL_PATTERN =
  /\bfs(?:\.promises)?\.(?:readFile|writeFile|appendFile|createReadStream|createWriteStream)\s*\(/;

const IMPORTED_FILESYSTEM_CALL_PATTERN =
  /\b(?:readFile|writeFile|appendFile|createReadStream|createWriteStream)\s*\(/;

const SENSITIVE_PATH_PATTERN =
  /(?:\.ssh\/|\.aws\/|\.npmrc|\.pypirc|\.env(?:\.|["'`)]|$)|\.git-credentials|id_rsa|id_ed25519|credentials\.json|service-account|token|api[_-]?key|secret)/i;

const USER_CONTROLLED_PATH_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:path|file|config|secret|credential)\b/i;

export const sensitiveLocalDataRule: Rule = {
  confidenceGuidance: [
    {
      level: "medium",
      reason: "fixed-sensitive-local-path",
      description: "A known secret-bearing local path was matched without clear tool-controlled path input."
    },
    {
      level: "high",
      reason: "tool-controlled-secret-path",
      description: "The secret-bearing path appears to come from tool or request input."
    }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: ["fixed-sensitive-local-path", "tool-controlled-secret-path"],
  defaultSeverity: "high",
  id: "mcp/sensitive-local-data",
  title: "Sensitive local credential or secret path access detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const hasFsImport = FS_IMPORT_PATTERN.test(file.content);

      file.lines.forEach((line, index) => {
        const hasFilesystemCall =
          QUALIFIED_FILESYSTEM_CALL_PATTERN.test(line) ||
          (hasFsImport && IMPORTED_FILESYSTEM_CALL_PATTERN.test(line));

        if (!hasFilesystemCall) {
          return;
        }

        const evidence = snippetFrom(file, index, 2);
        if (!SENSITIVE_PATH_PATTERN.test(evidence)) {
          return;
        }

        const confidence = USER_CONTROLLED_PATH_PATTERN.test(evidence) ? "high" : "medium";
        const confidenceReason = USER_CONTROLLED_PATH_PATTERN.test(evidence)
          ? "tool-controlled-secret-path"
          : "fixed-sensitive-local-path";

        findings.push(
          createFinding({
            ruleId: "mcp/sensitive-local-data",
            severity: "high",
            confidence,
            confidenceReason,
            title: sensitiveLocalDataRule.title,
            file: file.relativePath,
            line: index + 1,
            evidence,
            whyItMatters:
              "Access to local credential or secret-bearing paths can expose SSH keys, cloud credentials, tokens, and other host secrets before any outbound exfiltration is even considered.",
            remediation:
              "Avoid reading or writing host credential locations directly, constrain file access to explicit safe roots, and require deliberate operator opt-in for any secret-bearing local paths."
          })
        );
      });
    }

    return findings;
  }
};
