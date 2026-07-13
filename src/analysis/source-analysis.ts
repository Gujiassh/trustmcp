import ts from "typescript";

import type { ScanFile } from "../core/types.js";

export type AstCallNode = ts.CallExpression | ts.NewExpression;

export interface ImportedTarget {
  moduleName: string;
  members: string[];
}

export interface CallFact {
  node: AstCallNode;
  arguments: readonly ts.Expression[];
  lineIndex: number;
  memberPath: string[];
  scope: ts.Node;
}

export interface SourceAnalysis {
  file: ScanFile;
  sourceFile: ts.SourceFile;
  calls: CallFact[];
  bindings: ReadonlyMap<string, ImportedTarget>;
}

export type NetworkCallKind = "fetch" | "axios" | "http" | "got" | "undici";

const analysisCache = new WeakMap<ScanFile, SourceAnalysis>();
const FILESYSTEM_MODULES = new Set(["fs", "node:fs", "fs/promises", "node:fs/promises"]);
const FILESYSTEM_OPERATIONS = new Set([
  "readFile",
  "writeFile",
  "appendFile",
  "rm",
  "rmdir",
  "readdir",
  "opendir",
  "cp",
  "createReadStream",
  "createWriteStream",
  "unlink"
]);
const FILESYSTEM_WRITE_OPERATIONS = new Set(["writeFile", "appendFile", "createWriteStream"]);
const SHELL_OPERATIONS = new Set([
  "exec",
  "execFile",
  "execSync",
  "execFileSync",
  "spawn",
  "spawnSync",
  "fork"
]);
const EXECA_OPERATIONS = new Set(["default", "execa", "execaCommand", "execaCommandSync", "execaSync"]);
const VM_OPERATIONS = new Set([
  "runInThisContext",
  "runInNewContext",
  "runInContext",
  "compileFunction",
  "Script"
]);

export function analyzeSourceFile(file: ScanFile): SourceAnalysis {
  const cached = analysisCache.get(file);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const sourceFile = ts.createSourceFile(
      file.absolutePath,
      file.content,
      ts.ScriptTarget.Latest,
      true,
      scriptKindFor(file.relativePath)
    );
    const bindings = collectImportBindings(sourceFile);
    const calls: CallFact[] = [];

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        calls.push({
          node,
          arguments: node.arguments ?? [],
          lineIndex: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line,
          memberPath: getMemberPath(node.expression),
          scope: findNearestScope(node)
        });
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    const analysis = { file, sourceFile, calls, bindings };
    analysisCache.set(file, analysis);
    return analysis;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to parse ${file.relativePath} for executable-code analysis: ${message}`);
  }
}

export function resolveImportedTarget(analysis: SourceAnalysis, call: CallFact): ImportedTarget | null {
  const root = call.memberPath[0];
  if (root === undefined) {
    return null;
  }

  const binding = analysis.bindings.get(root);
  if (binding === undefined) {
    return null;
  }

  return {
    moduleName: binding.moduleName,
    members: [...binding.members, ...call.memberPath.slice(1)]
  };
}

export function classifyFilesystemCall(
  analysis: SourceAnalysis,
  call: CallFact
): { operation: string; write: boolean } | null {
  const imported = resolveImportedTarget(analysis, call);
  if (imported !== null && FILESYSTEM_MODULES.has(imported.moduleName)) {
    const operation = last(imported.members);
    if (operation !== undefined && FILESYSTEM_OPERATIONS.has(operation)) {
      return { operation, write: FILESYSTEM_WRITE_OPERATIONS.has(operation) };
    }
  }

  const operation = last(call.memberPath);
  if (
    operation !== undefined &&
    FILESYSTEM_OPERATIONS.has(operation) &&
    isRawFilesystemMemberPath(call.memberPath)
  ) {
    return { operation, write: FILESYSTEM_WRITE_OPERATIONS.has(operation) };
  }

  return null;
}

export function classifyShellCall(analysis: SourceAnalysis, call: CallFact): string | null {
  const imported = resolveImportedTarget(analysis, call);
  if (imported !== null) {
    const operation = last(imported.members);
    if (
      (imported.moduleName === "child_process" || imported.moduleName === "node:child_process") &&
      operation !== undefined &&
      SHELL_OPERATIONS.has(operation)
    ) {
      return operation;
    }

    if (imported.moduleName === "execa" && operation !== undefined && EXECA_OPERATIONS.has(operation)) {
      return operation;
    }
  }

  const [root, second] = call.memberPath;
  if (root === "child_process" && second !== undefined && SHELL_OPERATIONS.has(second)) {
    return second;
  }
  if (root === "Bun" && second === "spawn") {
    return "spawn";
  }

  return null;
}

export function classifyNetworkCall(analysis: SourceAnalysis, call: CallFact): NetworkCallKind | null {
  const imported = resolveImportedTarget(analysis, call);
  if (imported !== null) {
    const operation = last(imported.members);
    if (imported.moduleName === "axios") {
      return isNetworkMethod(operation) || operation === "default" ? "axios" : null;
    }
    if (imported.moduleName === "got") {
      return isNetworkMethod(operation) || operation === "default" || operation === "stream" ? "got" : null;
    }
    if (imported.moduleName === "undici" && (operation === "request" || operation === "fetch")) {
      return "undici";
    }
    if (
      ["http", "https", "node:http", "node:https"].includes(imported.moduleName) &&
      (operation === "request" || operation === "get")
    ) {
      return "http";
    }
  }

  const [root, operation] = call.memberPath;
  if (call.memberPath.length === 1 && root === "fetch") {
    return "fetch";
  }
  if (root === "axios" && (operation === undefined || isNetworkMethod(operation))) {
    return "axios";
  }
  if (root === "got" && (operation === undefined || isNetworkMethod(operation) || operation === "stream")) {
    return "got";
  }
  if (root === "undici" && (operation === "request" || operation === "fetch")) {
    return "undici";
  }
  if ((root === "http" || root === "https") && (operation === "request" || operation === "get")) {
    return "http";
  }

  return null;
}

export function classifyDynamicCodeCall(analysis: SourceAnalysis, call: CallFact): "direct" | "vm" | null {
  const [root] = call.memberPath;
  if (call.memberPath.length === 1 && (root === "eval" || root === "Function")) {
    return "direct";
  }

  const imported = resolveImportedTarget(analysis, call);
  if (imported !== null && (imported.moduleName === "vm" || imported.moduleName === "node:vm")) {
    const operation = last(imported.members);
    if (operation !== undefined && VM_OPERATIONS.has(operation)) {
      return "vm";
    }
  }

  const operation = last(call.memberPath);
  return call.memberPath[0] === "vm" && operation !== undefined && VM_OPERATIONS.has(operation)
    ? "vm"
    : null;
}

export function isArchiveCall(analysis: SourceAnalysis, call: CallFact): boolean {
  const imported = resolveImportedTarget(analysis, call);
  const operation = last(call.memberPath);
  if (imported !== null) {
    const importedOperation = last(imported.members);
    if (imported.moduleName === "adm-zip" && call.node.kind === ts.SyntaxKind.NewExpression) {
      return true;
    }
    if (imported.moduleName === "tar" && (importedOperation === "x" || importedOperation === "extract")) {
      return true;
    }
    if (["decompress", "unzipper"].includes(imported.moduleName)) {
      return true;
    }
  }

  return (
    (operation === "AdmZip" && call.node.kind === ts.SyntaxKind.NewExpression) ||
    operation === "extractAllTo" ||
    operation === "unzip" ||
    operation === "decompress" ||
    (call.memberPath[0] === "tar" && (operation === "x" || operation === "extract"))
  );
}

export function isListenerCall(call: CallFact): boolean {
  if (last(call.memberPath) !== "listen") {
    return false;
  }

  const receiver = ts.isPropertyAccessExpression(call.node.expression)
    ? call.node.expression.expression.getText()
    : "";
  return /^(?:app|server|httpServer|httpsServer|fastify|express)$/.test(receiver) ||
    /createServer\s*\(/.test(receiver);
}

export function callArgumentText(analysis: SourceAnalysis, call: CallFact): string {
  return call.arguments.map((argument) => argument.getText(analysis.sourceFile)).join(" ");
}

export function getStringLiteralValues(node: ts.Node): string[] {
  const values: string[] = [];
  const visit = (current: ts.Node): void => {
    if (ts.isStringLiteralLike(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
      values.push(current.text);
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return values;
}

export function isLiteralLikeExpression(expression: ts.Expression | undefined): boolean {
  if (expression === undefined) {
    return false;
  }
  return ts.isStringLiteralLike(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isTemplateExpression(expression) ||
    ts.isNumericLiteral(expression) ||
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    expression.kind === ts.SyntaxKind.NullKeyword ||
    isStaticUrlExpression(expression) ||
    containsImportMeta(expression);
}

export function scopeCalls(analysis: SourceAnalysis, scope: ts.Node): CallFact[] {
  return analysis.calls.filter((call) => call.scope === scope);
}

function collectImportBindings(sourceFile: ts.SourceFile): Map<string, ImportedTarget> {
  const bindings = new Map<string, ImportedTarget>();

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const moduleName = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (clause?.name !== undefined) {
        bindings.set(clause.name.text, { moduleName, members: ["default"] });
      }
      if (clause?.namedBindings !== undefined) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          bindings.set(clause.namedBindings.name.text, { moduleName, members: [] });
        } else {
          for (const element of clause.namedBindings.elements) {
            bindings.set(element.name.text, {
              moduleName,
              members: [element.propertyName?.text ?? element.name.text]
            });
          }
        }
      }
      continue;
    }

    if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference)) {
      const expression = statement.moduleReference.expression;
      if (expression !== undefined && ts.isStringLiteral(expression)) {
        bindings.set(statement.name.text, { moduleName: expression.text, members: [] });
      }
      continue;
    }

    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      const required = parseRequireInitializer(declaration.initializer);
      if (required === null) {
        continue;
      }
      if (ts.isIdentifier(declaration.name)) {
        bindings.set(declaration.name.text, required);
      } else if (ts.isObjectBindingPattern(declaration.name)) {
        for (const element of declaration.name.elements) {
          if (ts.isIdentifier(element.name)) {
            const importedName = element.propertyName !== undefined && ts.isIdentifier(element.propertyName)
              ? element.propertyName.text
              : element.name.text;
            bindings.set(element.name.text, {
              moduleName: required.moduleName,
              members: [...required.members, importedName]
            });
          }
        }
      }
    }
  }

  return bindings;
}

function parseRequireInitializer(initializer: ts.Expression | undefined): ImportedTarget | null {
  if (initializer === undefined) {
    return null;
  }
  if (
    ts.isCallExpression(initializer) &&
    ts.isIdentifier(initializer.expression) &&
    initializer.expression.text === "require" &&
    initializer.arguments.length === 1 &&
    ts.isStringLiteral(initializer.arguments[0]!)
  ) {
    return { moduleName: initializer.arguments[0]!.text, members: [] };
  }
  if (ts.isPropertyAccessExpression(initializer)) {
    const base = parseRequireInitializer(initializer.expression);
    return base === null
      ? null
      : { moduleName: base.moduleName, members: [...base.members, initializer.name.text] };
  }
  return null;
}

function getMemberPath(expression: ts.Expression): string[] {
  if (ts.isIdentifier(expression)) {
    return [expression.text];
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return [...getMemberPath(expression.expression), expression.name.text];
  }
  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression !== undefined &&
    ts.isStringLiteralLike(expression.argumentExpression)
  ) {
    return [...getMemberPath(expression.expression), expression.argumentExpression.text];
  }
  return [];
}

function findNearestScope(node: ts.Node): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current !== undefined) {
    if (ts.isSourceFile(current) || isFunctionScope(current)) {
      return current;
    }
    current = current.parent;
  }
  return node.getSourceFile();
}

export function isFunctionScope(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node);
}

function isRawFilesystemMemberPath(path: string[]): boolean {
  return path[0] === "fs" && (path.length === 2 || (path.length === 3 && path[1] === "promises"));
}

function isNetworkMethod(value: string | undefined): boolean {
  return value !== undefined && ["get", "post", "put", "patch", "delete", "request", "head", "options"].includes(value);
}

function last(values: string[]): string | undefined {
  return values[values.length - 1];
}

function scriptKindFor(path: string): ts.ScriptKind {
  if (/\.tsx$/i.test(path)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(path)) return ts.ScriptKind.JSX;
  if (/\.(?:ts|cts|mts)$/i.test(path)) return ts.ScriptKind.TS;
  if (/\.json$/i.test(path)) return ts.ScriptKind.JSON;
  return ts.ScriptKind.JS;
}

function isStaticUrlExpression(expression: ts.Expression): boolean {
  return ts.isNewExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "URL";
}

function containsImportMeta(expression: ts.Expression): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
}
