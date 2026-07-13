import { analyzeSourceFile, callArgumentText, classifyFilesystemCall } from "../analysis/source-analysis.js";
import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const SENSITIVE_PATH_PATTERN =
  /(?:\.ssh\/|\.aws\/|\.npmrc|\.pypirc|\.env(?:\.|["'`)]|$)|\.git-credentials|id_rsa|id_ed25519|credentials\.json|service-account|token|api[_-]?key|secret)/i;
const USER_CONTROLLED_PATH_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:path|file|config|secret|credential)\b/i;

export const sensitiveLocalDataRule: Rule = {
  confidenceGuidance: [
    { level: "medium", reason: "fixed-sensitive-local-path", description: "A known secret-bearing local path was matched without clear tool-controlled path input." },
    { level: "high", reason: "tool-controlled-secret-path", description: "The secret-bearing path appears to come from tool or request input." }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: ["fixed-sensitive-local-path", "tool-controlled-secret-path"],
  defaultSeverity: "high",
  id: "mcp/sensitive-local-data",
  title: "Sensitive local credential or secret path access detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const analysis = analyzeSourceFile(file);
      for (const call of analysis.calls) {
        if (classifyFilesystemCall(analysis, call) === null) {
          continue;
        }
        const argumentText = callArgumentText(analysis, call);
        if (!SENSITIVE_PATH_PATTERN.test(argumentText)) {
          continue;
        }
        const toolControlled = USER_CONTROLLED_PATH_PATTERN.test(argumentText);
        findings.push(createFinding({
          ruleId: "mcp/sensitive-local-data",
          severity: "high",
          confidence: toolControlled ? "high" : "medium",
          confidenceReason: toolControlled ? "tool-controlled-secret-path" : "fixed-sensitive-local-path",
          title: sensitiveLocalDataRule.title,
          file: file.relativePath,
          line: call.lineIndex + 1,
          evidence: snippetFrom(file, call.lineIndex, 2),
          whyItMatters: "Access to local credential or secret-bearing paths can expose SSH keys, cloud credentials, tokens, and other host secrets before any outbound exfiltration is even considered.",
          remediation: "Avoid reading or writing host credential locations directly, constrain file access to explicit safe roots, and require deliberate operator opt-in for any secret-bearing local paths."
        }));
      }
    }

    return findings;
  }
};
