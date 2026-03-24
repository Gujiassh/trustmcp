import { createFinding } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const CHILD_PROCESS_IMPORT_PATTERN =
  /(?:from\s+["']node:child_process["']|from\s+["']child_process["']|require\(["']node:child_process["']\)|require\(["']child_process["']\))/;

const QUALIFIED_SHELL_CALL_PATTERN =
  /\bchild_process\.(?:exec|execFile|execSync|execFileSync|spawn|spawnSync|fork)\s*\(/;

const IMPORTED_SHELL_CALL_PATTERN =
  /\b(?:exec|execFile|execSync|execFileSync|spawn|spawnSync|fork)\s*\(/;

const EXECA_PATTERN = /\bexeca(?:Command|CommandSync|Sync)?\s*\(/;
const BUN_PATTERN = /\bBun\.spawn\s*\(/;

export const shellExecRule: Rule = {
  id: "mcp/shell-exec",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const hasChildProcessImport = CHILD_PROCESS_IMPORT_PATTERN.test(file.content);

      file.lines.forEach((line, index) => {
        const isMatch =
          QUALIFIED_SHELL_CALL_PATTERN.test(line) ||
          EXECA_PATTERN.test(line) ||
          BUN_PATTERN.test(line) ||
          (hasChildProcessImport && IMPORTED_SHELL_CALL_PATTERN.test(line));

        if (!isMatch) {
          return;
        }

        findings.push(
          createFinding({
            ruleId: "mcp/shell-exec",
            severity: "high",
            confidence: "high",
            title: "Shell execution capability detected",
            file: file.relativePath,
            line: index + 1,
            evidence: line,
            whyItMatters:
              "Shell execution can turn tool input into arbitrary host commands.",
            remediation:
              "Prefer fixed command allowlists, avoid shell string interpolation, and require explicit operator approval for host command execution."
          })
        );
      });
    }

    return findings;
  }
};
