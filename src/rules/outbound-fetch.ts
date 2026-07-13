import { analyzeSourceFile, callArgumentText, classifyNetworkCall } from "../analysis/source-analysis.js";
import { createFinding } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const USER_CONTROLLED_URL_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*url\b/i;

export const outboundFetchRule: Rule = {
  confidenceGuidance: [
    { level: "medium", reason: "literal-fetch-call", description: "A plain fetch call was matched without clear tool-controlled destination evidence." },
    { level: "high", reason: "non-fetch-network-client", description: "A stronger network client surface such as axios, http(s), got, or undici was matched." },
    { level: "high", reason: "tool-controlled-url", description: "The destination URL appears to come from tool or request input." }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: ["literal-fetch-call", "non-fetch-network-client", "tool-controlled-url"],
  defaultSeverity: "medium",
  id: "mcp/outbound-fetch",
  title: "Outbound network request capability detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const analysis = analyzeSourceFile(file);
      for (const call of analysis.calls) {
        const kind = classifyNetworkCall(analysis, call);
        if (kind === null) {
          continue;
        }
        const toolControlled = USER_CONTROLLED_URL_PATTERN.test(callArgumentText(analysis, call));
        findings.push(createFinding({
          ruleId: "mcp/outbound-fetch",
          severity: "medium",
          confidence: toolControlled || kind !== "fetch" ? "high" : "medium",
          confidenceReason: toolControlled ? "tool-controlled-url" : kind !== "fetch" ? "non-fetch-network-client" : "literal-fetch-call",
          title: outboundFetchRule.title,
          file: file.relativePath,
          line: call.lineIndex + 1,
          evidence: file.lines[call.lineIndex] ?? "",
          whyItMatters: "Outbound requests can send prompts, tokens, or local data to remote services.",
          remediation: "Restrict destinations with allowlists, validate user-provided URLs, and separate read-only tools from network-capable tools."
        }));
      }
    }

    return findings;
  }
};
