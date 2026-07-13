import ts from "typescript";

import { buildTaintedIdentifiers, expressionUsesTaint, visitScope } from "../analysis/flow-analysis.js";
import {
  analyzeSourceFile,
  classifyNetworkCall,
  classifyShellCall,
  isFunctionScope,
  type SourceAnalysis
} from "../analysis/source-analysis.js";
import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const SECRET_NAME_PATTERN = /(?:TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL|AUTH)/i;
const LOG_METHODS = new Set(["log", "error", "warn", "info"]);

export const envSecretExposureRule: Rule = {
  confidenceGuidance: [
    { level: "high", reason: "secret-env-var-reaches-dangerous-sink", description: "A secret-bearing environment variable appears to flow into a network, execution, logging, or return sink." }
  ],
  confidenceLevels: ["high"],
  confidenceReasons: ["secret-env-var-reaches-dangerous-sink"],
  defaultSeverity: "high",
  id: "mcp/env-secret-exposure",
  title: "Environment secret exposure path detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const analysis = analyzeSourceFile(file);
      for (const source of collectSecretEnvironmentReads(analysis)) {
        if (!secretReachesSink(analysis, source.scope, source.expression)) {
          continue;
        }
        const lineIndex = analysis.sourceFile.getLineAndCharacterOfPosition(source.expression.getStart()).line;
        findings.push(createFinding({
          ruleId: "mcp/env-secret-exposure",
          severity: "high",
          confidence: "high",
          confidenceReason: "secret-env-var-reaches-dangerous-sink",
          title: envSecretExposureRule.title,
          file: file.relativePath,
          line: lineIndex + 1,
          evidence: snippetFrom(file, lineIndex, 2),
          whyItMatters: "Reading secret-bearing environment variables and then flowing them into outbound requests, execution paths, logs, or tool responses can expose host credentials directly.",
          remediation: "Avoid exposing process.env secrets to tools, responses, logs, or remote calls; keep secret access isolated behind fixed trusted flows."
        }));
      }
    }

    return findings;
  }
};

function collectSecretEnvironmentReads(
  analysis: SourceAnalysis
): Array<{ expression: ts.Expression; scope: ts.Node }> {
  const reads: Array<{ expression: ts.Expression; scope: ts.Node }> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isExpression(node)) {
      const name = getEnvironmentVariableName(node);
      if (name !== null && SECRET_NAME_PATTERN.test(name)) {
        reads.push({ expression: node, scope: nearestScope(node) });
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(analysis.sourceFile);
  return reads;
}

function secretReachesSink(analysis: SourceAnalysis, scope: ts.Node, source: ts.Expression): boolean {
  const sources = new Set<ts.Node>([source]);
  let reached = false;

  visitScope(scope, (node) => {
    if (reached) return;
    if (ts.isReturnStatement(node) && node.expression !== undefined) {
      const tainted = buildTaintedIdentifiers(scope, [source], node.getStart());
      reached = returnExpressionExposesTaint(node.expression, tainted, sources);
      return;
    }
    if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) {
      return;
    }
    const call = analysis.calls.find((candidate) => candidate.node === node);
    if (call === undefined || !isDangerousSink(analysis, call)) {
      return;
    }
    const tainted = buildTaintedIdentifiers(scope, [source], call.node.getStart());
    reached = call.arguments.some((argument) => expressionUsesTaint(argument, tainted, sources));
  });

  return reached;
}

function returnExpressionExposesTaint(
  expression: ts.Expression,
  tainted: ReadonlySet<string>,
  sources: ReadonlySet<ts.Node>
): boolean {
  if (ts.isBinaryExpression(expression) && isComparisonOperator(expression.operatorToken.kind)) {
    return false;
  }
  return expressionUsesTaint(expression, tainted, sources);
}

function isComparisonOperator(kind: ts.SyntaxKind): boolean {
  return kind === ts.SyntaxKind.EqualsEqualsToken ||
    kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    kind === ts.SyntaxKind.ExclamationEqualsToken ||
    kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    kind === ts.SyntaxKind.LessThanToken ||
    kind === ts.SyntaxKind.LessThanEqualsToken ||
    kind === ts.SyntaxKind.GreaterThanToken ||
    kind === ts.SyntaxKind.GreaterThanEqualsToken ||
    kind === ts.SyntaxKind.InKeyword ||
    kind === ts.SyntaxKind.InstanceOfKeyword;
}

function isDangerousSink(analysis: SourceAnalysis, call: SourceAnalysis["calls"][number]): boolean {
  if (classifyNetworkCall(analysis, call) !== null || classifyShellCall(analysis, call) !== null) {
    return true;
  }
  const [root, method] = call.memberPath;
  return root === "console" && method !== undefined && LOG_METHODS.has(method);
}

function getEnvironmentVariableName(node: ts.Expression): string | null {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "process" &&
    node.expression.name.text === "env"
  ) {
    return node.name.text;
  }
  if (
    ts.isElementAccessExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "process" &&
    node.expression.name.text === "env" &&
    node.argumentExpression !== undefined &&
    ts.isStringLiteralLike(node.argumentExpression)
  ) {
    return node.argumentExpression.text;
  }
  return null;
}

function nearestScope(node: ts.Node): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current !== undefined) {
    if (ts.isSourceFile(current) || isFunctionScope(current)) {
      return current;
    }
    current = current.parent;
  }
  return node.getSourceFile();
}
