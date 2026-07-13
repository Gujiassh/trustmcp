import { analyzeSourceFile, classifyShellCall } from "../analysis/source-analysis.js";
import { createFinding } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

export const shellExecRule: Rule = {
  confidenceGuidance: [
    { level: "high", reason: "direct-command-execution-api", description: "Direct command execution primitives such as child_process, execa, or Bun.spawn were matched." }
  ],
  confidenceLevels: ["high"],
  confidenceReasons: ["direct-command-execution-api"],
  defaultSeverity: "high",
  id: "mcp/shell-exec",
  title: "Shell execution capability detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const analysis = analyzeSourceFile(file);
      for (const call of analysis.calls) {
        if (classifyShellCall(analysis, call) === null) {
          continue;
        }
        findings.push(createFinding({
          ruleId: "mcp/shell-exec",
          severity: "high",
          confidence: "high",
          confidenceReason: "direct-command-execution-api",
          title: shellExecRule.title,
          file: file.relativePath,
          line: call.lineIndex + 1,
          evidence: file.lines[call.lineIndex] ?? "",
          whyItMatters: "Shell execution can turn tool input into arbitrary host commands.",
          remediation: "Prefer fixed command allowlists, avoid shell string interpolation, and require explicit operator approval for host command execution."
        }));
      }
    }

    return findings;
  }
};
