import { createFinding } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const FETCH_PATTERN = /\bfetch\s*\(/;
const AXIOS_PATTERN = /\baxios(?:\.(?:get|post|put|patch|delete|request|head|options))?\s*\(/;
const HTTP_PATTERN = /\bhttps?\.(?:request|get)\s*\(/;
const GOT_PATTERN = /\bgot(?:\.(?:get|post|put|patch|delete|stream|head))?\s*\(/;
const UNDICI_PATTERN = /\bundici\.(?:request|fetch)\s*\(/;
const USER_CONTROLLED_URL_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*url\b/i;

export const outboundFetchRule: Rule = {
  defaultSeverity: "medium",
  id: "mcp/outbound-fetch",
  title: "Outbound network request capability detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      file.lines.forEach((line, index) => {
        const matchedPattern = detectPattern(line);
        if (matchedPattern === null) {
          return;
        }

        const confidence = USER_CONTROLLED_URL_PATTERN.test(line) || matchedPattern !== "fetch"
          ? "high"
          : "medium";

        findings.push(
          createFinding({
            ruleId: "mcp/outbound-fetch",
            severity: "medium",
            confidence,
            title: outboundFetchRule.title,
            file: file.relativePath,
            line: index + 1,
            evidence: line,
            whyItMatters:
              "Outbound requests can send prompts, tokens, or local data to remote services.",
            remediation:
              "Restrict destinations with allowlists, validate user-provided URLs, and separate read-only tools from network-capable tools."
          })
        );
      });
    }

    return findings;
  }
};

function detectPattern(line: string): "fetch" | "axios" | "http" | "got" | "undici" | null {
  if (AXIOS_PATTERN.test(line)) {
    return "axios";
  }

  if (HTTP_PATTERN.test(line)) {
    return "http";
  }

  if (GOT_PATTERN.test(line)) {
    return "got";
  }

  if (UNDICI_PATTERN.test(line)) {
    return "undici";
  }

  if (FETCH_PATTERN.test(line)) {
    return "fetch";
  }

  return null;
}
