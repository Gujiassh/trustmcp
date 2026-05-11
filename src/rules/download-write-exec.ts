import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const NETWORK_PATTERN =
  /\bfetch\s*\(|\baxios(?:\.(?:get|post|put|patch|delete|request|head|options))?\s*\(|\bhttps?\.(?:request|get)\s*\(|\bgot(?:\.(?:get|post|put|patch|delete|stream|head))?\s*\(|\bundici\.(?:request|fetch)\s*\(/;

const WRITE_PATTERN =
  /\b(?:writeFile|appendFile|createWriteStream|fs(?:\.promises)?\.(?:writeFile|appendFile|createWriteStream))\s*\(/;

const EXEC_PATTERN =
  /\bchild_process\.(?:exec|execFile|execSync|execFileSync|spawn|spawnSync|fork)\s*\(|\b(?:exec|execFile|execSync|execFileSync|spawn|spawnSync|fork)\s*\(|\bexeca(?:Command|CommandSync|Sync)?\s*\(|\bBun\.spawn\s*\(|\b(?:npm|pnpm|yarn|bun)\s+run\b|\bnpx\b|\btsx\b|\bnode\s+(?:scripts?|bin)\//;

const USER_CONTROLLED_DOWNLOAD_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:url|download|script|command|file|path)\b/i;

export const downloadWriteExecRule: Rule = {
  confidenceGuidance: [
    {
      level: "medium",
      reason: "fixed-download-write-exec-chain",
      description: "A download-write-execute chain was matched without clear tool-controlled download or execution input."
    },
    {
      level: "high",
      reason: "tool-controlled-download-or-exec-input",
      description: "The download source, written artifact, or execution step appears to depend on tool input."
    }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: ["fixed-download-write-exec-chain", "tool-controlled-download-or-exec-input"],
  defaultSeverity: "high",
  id: "mcp/download-write-exec",
  title: "Download-to-disk execution chain detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const hasNetwork = file.lines.some((line) => NETWORK_PATTERN.test(line));
      const hasWrite = file.lines.some((line) => WRITE_PATTERN.test(line));
      const hasExec = file.lines.some((line) => EXEC_PATTERN.test(line));

      if (!hasNetwork || !hasWrite || !hasExec) {
        continue;
      }

      const lineIndex = file.lines.findIndex((line) => NETWORK_PATTERN.test(line));
      const line = lineIndex === -1 ? undefined : lineIndex + 1;
      const evidence = snippetFrom(file, lineIndex === -1 ? 0 : lineIndex, 6);
      const confidence = USER_CONTROLLED_DOWNLOAD_PATTERN.test(evidence) ? "high" : "medium";
      const confidenceReason = USER_CONTROLLED_DOWNLOAD_PATTERN.test(evidence)
        ? "tool-controlled-download-or-exec-input"
        : "fixed-download-write-exec-chain";

      findings.push(
        createFinding({
          ruleId: "mcp/download-write-exec",
          severity: "high",
          confidence,
          confidenceReason,
          title: downloadWriteExecRule.title,
          file: file.relativePath,
          ...(line === undefined ? {} : { line }),
          evidence,
          whyItMatters:
            "Fetching remote content, writing it locally, and then executing or running it can bridge untrusted network input into direct host-side code execution.",
          remediation:
            "Avoid download-and-run chains, require explicit review before executing downloaded artifacts, and separate retrieval, storage, and execution into fixed allowlisted flows."
        })
      );
    }

    return findings;
  }
};
