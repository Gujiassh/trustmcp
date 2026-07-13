import ts from "typescript";

import type { AstCallNode } from "./source-analysis.js";
import { isFunctionScope } from "./source-analysis.js";

export function buildTaintedIdentifiers(
  scope: ts.Node,
  sourceNodes: Iterable<AstCallNode | ts.Expression>,
  beforePosition = Number.POSITIVE_INFINITY
): Set<string> {
  const sources = new Set<ts.Node>(sourceNodes);
  const assignments: Array<{ name: string; expression: ts.Expression }> = [];

  walkScope(scope, scope, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
      if (node.getStart() < beforePosition) {
        assignments.push({ name: node.name.text, expression: node.initializer });
      }
      return;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      if (node.getStart() < beforePosition) {
        assignments.push({ name: node.left.text, expression: node.right });
      }
    }
  });

  const tainted = new Set<string>();
  assignments.sort((left, right) => left.expression.getStart() - right.expression.getStart());
  for (const assignment of assignments) {
    if (expressionUsesTaint(assignment.expression, tainted, sources)) {
      tainted.add(assignment.name);
    } else {
      tainted.delete(assignment.name);
    }
  }
  return tainted;
}

export function expressionUsesTaint(
  expression: ts.Node,
  taintedIdentifiers: ReadonlySet<string>,
  sourceNodes: ReadonlySet<ts.Node> = new Set()
): boolean {
  let matched = false;
  const visit = (node: ts.Node): void => {
    if (matched) {
      return;
    }
    if (sourceNodes.has(node) || (ts.isIdentifier(node) && taintedIdentifiers.has(node.text))) {
      matched = true;
      return;
    }
    if (node !== expression && isFunctionScope(node)) {
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return matched;
}

export function collectReferencedIdentifiers(node: ts.Node): Set<string> {
  const identifiers = new Set<string>();
  const visit = (current: ts.Node): void => {
    if (ts.isIdentifier(current) && isValueIdentifier(current)) {
      identifiers.add(current.text);
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return identifiers;
}

export function visitScope(scope: ts.Node, visitor: (node: ts.Node) => void): void {
  walkScope(scope, scope, visitor);
}

function walkScope(scope: ts.Node, node: ts.Node, visitor: (node: ts.Node) => void): void {
  visitor(node);
  ts.forEachChild(node, (child) => {
    if (child !== scope && isFunctionScope(child)) {
      return;
    }
    walkScope(scope, child, visitor);
  });
}

function isValueIdentifier(identifier: ts.Identifier): boolean {
  const parent = identifier.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === identifier) {
    return false;
  }
  if ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent)) && parent.name === identifier) {
    return false;
  }
  return true;
}
