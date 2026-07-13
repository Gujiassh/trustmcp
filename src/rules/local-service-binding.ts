import { analyzeSourceFile, callArgumentText, getStringLiteralValues, isListenerCall } from "../analysis/source-analysis.js";
import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const USER_CONTROLLED_BIND_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:host|port|listen|bind)\b/i;
const PUBLIC_BINDS = new Set(["0.0.0.0", "[::]", "::"]);

export const localServiceBindingRule: Rule = {
  confidenceGuidance: [
    { level: "medium", reason: "local-listener-startup", description: "A local listener startup path was matched without explicit public bind or tool-controlled bind input." },
    { level: "high", reason: "explicit-public-bind-address", description: "The listener binds an explicitly public address such as 0.0.0.0 or ::." },
    { level: "high", reason: "tool-controlled-bind-parameter", description: "The host, port, or bind target appears to come from tool or request input." }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: ["local-listener-startup", "explicit-public-bind-address", "tool-controlled-bind-parameter"],
  defaultSeverity: "medium",
  id: "mcp/local-service-binding",
  title: "Local service or port-binding capability detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const analysis = analyzeSourceFile(file);
      for (const call of analysis.calls) {
        if (!isListenerCall(call)) {
          continue;
        }
        const toolControlled = USER_CONTROLLED_BIND_PATTERN.test(callArgumentText(analysis, call));
        const publicBind = call.arguments.some((argument) => getStringLiteralValues(argument).some((value) => PUBLIC_BINDS.has(value)));
        findings.push(createFinding({
          ruleId: "mcp/local-service-binding",
          severity: "medium",
          confidence: toolControlled || publicBind ? "high" : "medium",
          confidenceReason: toolControlled ? "tool-controlled-bind-parameter" : publicBind ? "explicit-public-bind-address" : "local-listener-startup",
          title: localServiceBindingRule.title,
          file: file.relativePath,
          line: call.lineIndex + 1,
          evidence: snippetFrom(file, call.lineIndex, 2),
          whyItMatters: "Spawning local listeners or binding public interfaces can expand the reachable surface of an MCP server beyond the immediate tool call path.",
          remediation: "Avoid opening local listeners unless necessary, constrain bind addresses and ports, and keep network-facing service startup out of general-purpose tool flows."
        }));
      }
    }

    return findings;
  }
};
