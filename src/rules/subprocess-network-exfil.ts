import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const NETWORK_PATTERN =
  /\bfetch\s*\(|\baxios(?:\.(?:get|post|put|patch|delete|request|head|options))?\s*\(|\bhttps?\.(?:request|get)\s*\(|\bgot(?:\.(?:get|post|put|patch|delete|stream|head))?\s*\(|\bundici\.(?:request|fetch)\s*\(/;

const EXEC_PATTERN =
  /\bchild_process\.(?:exec|execFile|execSync|execFileSync|spawn|spawnSync|fork)\s*\(|\b(?:exec|execFile|execSync|execFileSync|spawn|spawnSync|fork)\s*\(|\bexeca(?:Command|CommandSync|Sync)?\s*\(|\bBun\.spawn\s*\(/;

const USER_CONTROLLED_EXFIL_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:command|url|output|result|payload|target)\b/i;

export const subprocessNetworkExfilRule: Rule = {
  confidenceGuidance: [
    {
      level: "medium",
      reason: "subprocess-plus-network-chain",
      description: "A subprocess plus outbound network chain was matched without clear tool-controlled exfiltration input."
    },
    {
      level: "high",
      reason: "tool-controlled-exfiltration-path",
      description: "The command, URL, output path, or payload appears to be controlled by tool input."
    }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: ["subprocess-plus-network-chain", "tool-controlled-exfiltration-path"],
  defaultSeverity: "high",
  id: "mcp/subprocess-network-exfil",
  title: "Subprocess plus network exfiltration path detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const hasNetwork = file.lines.some((line) => NETWORK_PATTERN.test(line));
      const hasExec = file.lines.some((line) => EXEC_PATTERN.test(line));

      if (!hasNetwork || !hasExec) {
        continue;
      }

      const lineIndex = file.lines.findIndex((line) => EXEC_PATTERN.test(line) || NETWORK_PATTERN.test(line));
      const line = lineIndex === -1 ? undefined : lineIndex + 1;
      const evidence = snippetFrom(file, lineIndex === -1 ? 0 : lineIndex, 5);
      const confidence = USER_CONTROLLED_EXFIL_PATTERN.test(evidence) ? "high" : "medium";
      const confidenceReason = USER_CONTROLLED_EXFIL_PATTERN.test(evidence)
        ? "tool-controlled-exfiltration-path"
        : "subprocess-plus-network-chain";

      findings.push(
        createFinding({
          ruleId: "mcp/subprocess-network-exfil",
          severity: "high",
          confidence,
          confidenceReason,
          title: subprocessNetworkExfilRule.title,
          file: file.relativePath,
          ...(line === undefined ? {} : { line }),
          evidence,
          whyItMatters:
            "Combining local command execution with outbound network requests in the same flow can create a direct exfiltration path from host-side execution into remote systems.",
          remediation:
            "Separate command execution from outbound communication, avoid sending command output to remote destinations by default, and require explicit allowlisted exfiltration paths."
        })
      );
    }

    return findings;
  }
};
