import { analyzeSourceFile, callArgumentText, classifyDynamicCodeCall } from "../analysis/source-analysis.js";
import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const USER_CONTROLLED_CODE_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:code|script|source|template|expression)\b/i;

export const dynamicCodeExecRule: Rule = {
  confidenceGuidance: [
    { level: "medium", reason: "literal-dynamic-eval", description: "A direct eval or Function-style primitive was matched without clear tool-controlled code input." },
    { level: "high", reason: "vm-execution-api", description: "A vm execution API was matched, which is treated as a stronger dynamic execution surface." },
    { level: "high", reason: "tool-controlled-code-input", description: "The executed code string appears to come from tool or request input." }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: ["literal-dynamic-eval", "vm-execution-api", "tool-controlled-code-input"],
  defaultSeverity: "high",
  id: "mcp/dynamic-code-exec",
  title: "Dynamic code execution capability detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const analysis = analyzeSourceFile(file);
      for (const call of analysis.calls) {
        const kind = classifyDynamicCodeCall(analysis, call);
        if (kind === null) {
          continue;
        }
        const toolControlled = USER_CONTROLLED_CODE_PATTERN.test(callArgumentText(analysis, call));
        findings.push(createFinding({
          ruleId: "mcp/dynamic-code-exec",
          severity: "high",
          confidence: toolControlled || kind === "vm" ? "high" : "medium",
          confidenceReason: toolControlled ? "tool-controlled-code-input" : kind === "vm" ? "vm-execution-api" : "literal-dynamic-eval",
          title: dynamicCodeExecRule.title,
          file: file.relativePath,
          line: call.lineIndex + 1,
          evidence: snippetFrom(file, call.lineIndex, 1),
          whyItMatters: "Dynamic code execution can turn tool input or generated strings into arbitrary runtime behavior inside the host process.",
          remediation: "Avoid eval-style execution paths, reject tool-controlled code strings, and replace dynamic execution with fixed operations or explicit allowlisted interpreters."
        }));
      }
    }

    return findings;
  }
};
