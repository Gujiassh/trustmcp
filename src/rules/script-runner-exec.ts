import { createFinding } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const RUNNER_PATTERN =
  /\b(?:npm|pnpm|yarn|bun)\s+run\b|\bnpx\b|\btsx\b|\bnode\s+(?:scripts?|bin)\//;

const USER_CONTROLLED_COMMAND_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:command|script|task|runner|tool)\b/i;

export const scriptRunnerExecRule: Rule = {
  confidenceGuidance: [
    {
      level: "medium",
      reason: "fixed-script-runner-command",
      description: "A package-manager or script-runner execution wrapper was matched with a fixed command."
    },
    {
      level: "high",
      reason: "tool-controlled-script-runner-input",
      description: "The script, task, or runner input appears to come from tool or request data."
    }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: ["fixed-script-runner-command", "tool-controlled-script-runner-input"],
  defaultSeverity: "high",
  id: "mcp/script-runner-exec",
  title: "Script runner or package-manager execution wrapper detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      file.lines.forEach((line, index) => {
        if (!RUNNER_PATTERN.test(line)) {
          return;
        }

        const confidence = USER_CONTROLLED_COMMAND_PATTERN.test(line) ? "high" : "medium";
        const confidenceReason = USER_CONTROLLED_COMMAND_PATTERN.test(line)
          ? "tool-controlled-script-runner-input"
          : "fixed-script-runner-command";

        findings.push(
          createFinding({
            ruleId: "mcp/script-runner-exec",
            severity: "high",
            confidence,
            confidenceReason,
            title: scriptRunnerExecRule.title,
            file: file.relativePath,
            line: index + 1,
            evidence: line,
            whyItMatters:
              "Package-manager and script-runner wrappers can still launch host-side code even when direct child_process calls are hidden behind helper commands.",
            remediation:
              "Avoid handing tool-controlled input to npm/pnpm/yarn/bun/npx or script-runner wrappers, and prefer fixed allowlisted tasks over generic execution entrypoints."
          })
        );
      });
    }

    return findings;
  }
};
