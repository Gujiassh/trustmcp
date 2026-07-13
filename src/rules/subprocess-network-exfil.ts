import { buildTaintedIdentifiers, expressionUsesTaint } from "../analysis/flow-analysis.js";
import {
  analyzeSourceFile,
  callArgumentText,
  classifyNetworkCall,
  classifyShellCall,
  scopeCalls,
  type CallFact,
  type SourceAnalysis
} from "../analysis/source-analysis.js";
import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const USER_CONTROLLED_EXFIL_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:command|url|output|result|payload|target)\b/i;

export const subprocessNetworkExfilRule: Rule = {
  confidenceGuidance: [
    { level: "medium", reason: "subprocess-plus-network-chain", description: "A subprocess plus outbound network chain was matched without clear tool-controlled exfiltration input." },
    { level: "high", reason: "tool-controlled-exfiltration-path", description: "The command, URL, output path, or payload appears to be controlled by tool input." }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: ["subprocess-plus-network-chain", "tool-controlled-exfiltration-path"],
  defaultSeverity: "high",
  id: "mcp/subprocess-network-exfil",
  title: "Subprocess plus network exfiltration path detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const analysis = analyzeSourceFile(file);
      const chain = findExfiltrationChain(analysis);
      if (chain === null) {
        continue;
      }
      const evidence = snippetFrom(file, chain.exec.lineIndex, chain.network.lineIndex - chain.exec.lineIndex);
      const toolControlled = USER_CONTROLLED_EXFIL_PATTERN.test(
        `${callArgumentText(analysis, chain.exec)} ${callArgumentText(analysis, chain.network)}`
      );
      findings.push(createFinding({
        ruleId: "mcp/subprocess-network-exfil",
        severity: "high",
        confidence: toolControlled ? "high" : "medium",
        confidenceReason: toolControlled ? "tool-controlled-exfiltration-path" : "subprocess-plus-network-chain",
        title: subprocessNetworkExfilRule.title,
        file: file.relativePath,
        line: chain.exec.lineIndex + 1,
        evidence,
        whyItMatters: "Combining local command execution with outbound network requests in the same flow can create a direct exfiltration path from host-side execution into remote systems.",
        remediation: "Separate command execution from outbound communication, avoid sending command output to remote destinations by default, and require explicit allowlisted exfiltration paths."
      }));
    }

    return findings;
  }
};

function findExfiltrationChain(analysis: SourceAnalysis): { exec: CallFact; network: CallFact } | null {
  const scopes = new Set(analysis.calls.map((call) => call.scope));
  for (const scope of scopes) {
    const calls = scopeCalls(analysis, scope);
    const execs = calls.filter((call) => classifyShellCall(analysis, call) !== null);
    const networks = calls.filter((call) => classifyNetworkCall(analysis, call) !== null);
    for (const exec of execs) {
      const sourceNodes = new Set([exec.node]);
      for (const network of networks) {
        const tainted = buildTaintedIdentifiers(scope, [exec.node], network.node.getStart());
        if (
          network.node.getStart() > exec.node.getStart() &&
          network.arguments.some((argument) => expressionUsesTaint(argument, tainted, sourceNodes))
        ) {
          return { exec, network };
        }
      }
    }
  }
  return null;
}
