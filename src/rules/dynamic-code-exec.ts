import { createFinding, isImportPresent, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const DIRECT_DYNAMIC_EXECUTION_PATTERN =
  /\b(?:eval|Function)\s*\(|\bnew\s+Function\s*\(/;

const VM_MEMBER_PATTERN =
  /\bvm\.(?:runInThisContext|runInNewContext|runInContext|compileFunction|Script)\s*\(/;

const VM_IMPORTED_CALL_PATTERN =
  /\b(?:runInThisContext|runInNewContext|runInContext|compileFunction|Script)\s*\(/;

const USER_CONTROLLED_CODE_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:code|script|source|template|expression)\b/i;

export const dynamicCodeExecRule: Rule = {
  defaultSeverity: "high",
  id: "mcp/dynamic-code-exec",
  title: "Dynamic code execution capability detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const hasVmImport = isImportPresent(file, ["node:vm", "vm"]);

      file.lines.forEach((line, index) => {
        const matchedDirectExecution = DIRECT_DYNAMIC_EXECUTION_PATTERN.test(line);
        const matchedVmExecution =
          VM_MEMBER_PATTERN.test(line) ||
          (hasVmImport && VM_IMPORTED_CALL_PATTERN.test(line));

        if (!matchedDirectExecution && !matchedVmExecution) {
          return;
        }

        const evidence = snippetFrom(file, index, 1);
        const confidence = USER_CONTROLLED_CODE_PATTERN.test(evidence) || matchedVmExecution
          ? "high"
          : "medium";

        findings.push(
          createFinding({
            ruleId: "mcp/dynamic-code-exec",
            severity: "high",
            confidence,
            title: dynamicCodeExecRule.title,
            file: file.relativePath,
            line: index + 1,
            evidence,
            whyItMatters:
              "Dynamic code execution can turn tool input or generated strings into arbitrary runtime behavior inside the host process.",
            remediation:
              "Avoid eval-style execution paths, reject tool-controlled code strings, and replace dynamic execution with fixed operations or explicit allowlisted interpreters."
          })
        );
      });
    }

    return findings;
  }
};
