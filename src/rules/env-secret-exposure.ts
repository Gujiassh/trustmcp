import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const ENV_SECRET_PATTERN =
  /process\.env\.(?:[A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL|AUTH)[A-Z0-9_]*)\b/;

const DANGEROUS_USE_PATTERN =
  /\bfetch\s*\(|\baxios(?:\.(?:get|post|put|patch|delete|request|head|options))?\s*\(|\bhttps?\.(?:request|get)\s*\(|\bgot(?:\.(?:get|post|put|patch|delete|stream|head))?\s*\(|\bundici\.(?:request|fetch)\s*\(|\b(?:exec|execFile|execSync|execFileSync|spawn|spawnSync|fork)\s*\(|\bchild_process\.(?:exec|execFile|execSync|execFileSync|spawn|spawnSync|fork)\s*\(|\bexeca(?:Command|CommandSync|Sync)?\s*\(|\bBun\.spawn\s*\(|\bconsole\.(?:log|error|warn|info)\s*\(|\breturn\b/;

export const envSecretExposureRule: Rule = {
  confidenceGuidance: [
    {
      level: "high",
      reason: "secret-env-var-reaches-dangerous-sink",
      description: "A secret-bearing environment variable appears to flow into a network, execution, logging, or return sink."
    }
  ],
  confidenceLevels: ["high"],
  confidenceReasons: ["secret-env-var-reaches-dangerous-sink"],
  defaultSeverity: "high",
  id: "mcp/env-secret-exposure",
  title: "Environment secret exposure path detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      file.lines.forEach((line, index) => {
        if (!ENV_SECRET_PATTERN.test(line)) {
          return;
        }

        const evidence = snippetFrom(file, index, 2);
        if (!DANGEROUS_USE_PATTERN.test(evidence)) {
          return;
        }

        findings.push(
          createFinding({
            ruleId: "mcp/env-secret-exposure",
            severity: "high",
            confidence: "high",
            confidenceReason: "secret-env-var-reaches-dangerous-sink",
            title: envSecretExposureRule.title,
            file: file.relativePath,
            line: index + 1,
            evidence,
            whyItMatters:
              "Reading secret-bearing environment variables and then flowing them into outbound requests, execution paths, logs, or tool responses can expose host credentials directly.",
            remediation:
              "Avoid exposing process.env secrets to tools, responses, logs, or remote calls; keep secret access isolated behind fixed trusted flows."
          })
        );
      });
    }

    return findings;
  }
};
