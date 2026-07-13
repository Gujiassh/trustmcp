import { buildTaintedIdentifiers, collectReferencedIdentifiers, expressionUsesTaint } from "../analysis/flow-analysis.js";
import {
  analyzeSourceFile,
  callArgumentText,
  classifyFilesystemCall,
  classifyNetworkCall,
  classifyShellCall,
  getStringLiteralValues,
  scopeCalls,
  type CallFact,
  type SourceAnalysis
} from "../analysis/source-analysis.js";
import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const USER_CONTROLLED_DOWNLOAD_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:url|download|script|command|file|path)\b/i;

export const downloadWriteExecRule: Rule = {
  confidenceGuidance: [
    { level: "medium", reason: "fixed-download-write-exec-chain", description: "A download-write-execute chain was matched without clear tool-controlled download or execution input." },
    { level: "high", reason: "tool-controlled-download-or-exec-input", description: "The download source, written artifact, or execution step appears to depend on tool input." }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: ["fixed-download-write-exec-chain", "tool-controlled-download-or-exec-input"],
  defaultSeverity: "high",
  id: "mcp/download-write-exec",
  title: "Download-to-disk execution chain detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const analysis = analyzeSourceFile(file);
      const chain = findDownloadWriteExecChain(analysis);
      if (chain === null) {
        continue;
      }
      const evidence = snippetFrom(file, chain.network.lineIndex, chain.exec.lineIndex - chain.network.lineIndex);
      const toolControlled = USER_CONTROLLED_DOWNLOAD_PATTERN.test(
        [chain.network, chain.write, chain.exec].map((call) => callArgumentText(analysis, call)).join(" ")
      );
      findings.push(createFinding({
        ruleId: "mcp/download-write-exec",
        severity: "high",
        confidence: toolControlled ? "high" : "medium",
        confidenceReason: toolControlled ? "tool-controlled-download-or-exec-input" : "fixed-download-write-exec-chain",
        title: downloadWriteExecRule.title,
        file: file.relativePath,
        line: chain.network.lineIndex + 1,
        evidence,
        whyItMatters: "Fetching remote content, writing it locally, and then executing or running it can bridge untrusted network input into direct host-side code execution.",
        remediation: "Avoid download-and-run chains, require explicit review before executing downloaded artifacts, and separate retrieval, storage, and execution into fixed allowlisted flows."
      }));
    }

    return findings;
  }
};

function findDownloadWriteExecChain(
  analysis: SourceAnalysis
): { network: CallFact; write: CallFact; exec: CallFact } | null {
  const scopes = new Set(analysis.calls.map((call) => call.scope));
  for (const scope of scopes) {
    const calls = scopeCalls(analysis, scope);
    const networks = calls.filter((call) => classifyNetworkCall(analysis, call) !== null);
    const writes = calls.filter((call) => classifyFilesystemCall(analysis, call)?.write === true);
    const execs = calls.filter((call) => classifyShellCall(analysis, call) !== null);

    for (const network of networks) {
      const sourceNodes = new Set([network.node]);
      for (const write of writes) {
        if (write.node.getStart() <= network.node.getStart() || write.arguments[1] === undefined) {
          continue;
        }
        const tainted = buildTaintedIdentifiers(scope, [network.node], write.node.getStart());
        if (!expressionUsesTaint(write.arguments[1], tainted, sourceNodes)) {
          continue;
        }
        for (const exec of execs) {
          if (exec.node.getStart() > write.node.getStart() && writtenPathReachesExec(write, exec)) {
            return { network, write, exec };
          }
        }
      }
    }
  }
  return null;
}

function writtenPathReachesExec(write: CallFact, exec: CallFact): boolean {
  const writePath = write.arguments[0];
  if (writePath === undefined) {
    return false;
  }
  const writeIdentifiers = collectReferencedIdentifiers(writePath);
  const execIdentifiers = new Set(exec.arguments.flatMap((argument) => [...collectReferencedIdentifiers(argument)]));
  if ([...writeIdentifiers].some((identifier) => execIdentifiers.has(identifier))) {
    return true;
  }

  const writtenLiterals = getStringLiteralValues(writePath).filter((value) => value.length > 0);
  const execLiterals = exec.arguments.flatMap((argument) => getStringLiteralValues(argument));
  return writtenLiterals.some((written) => execLiterals.some((executed) => executed.includes(written)));
}
