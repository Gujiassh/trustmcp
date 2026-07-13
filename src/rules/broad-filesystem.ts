import { analyzeSourceFile, callArgumentText, classifyFilesystemCall, isLiteralLikeExpression } from "../analysis/source-analysis.js";
import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const BROAD_OPERATIONS = new Set(["readdir", "opendir", "rm", "rmdir", "cp", "createReadStream", "createWriteStream"]);
const RECURSIVE_PATTERN = /\brecursive\s*:\s*true\b/;
const ROOT_PATH_PATTERN = /process\.env\.(?:HOME|USERPROFILE)|os\.homedir\s*\(|["'`]~\//;
const USER_PATH_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*path\b|\b(?:filePath|dirPath|targetPath|requestedPath|workspacePath|userPath|pathArg)\b/i;

export const broadFilesystemRule: Rule = {
  confidenceGuidance: [
    { level: "high", reason: "recursive-filesystem-operation", description: "A recursive filesystem operation such as rm/cp/readdir with recursive=true was matched." },
    { level: "high", reason: "root-or-home-directory-path", description: "The filesystem path reaches HOME, USERPROFILE, os.homedir(), or a tilde-rooted path." },
    { level: "high", reason: "broad-operation-with-tool-controlled-path", description: "A broad filesystem operation appears to take a tool-controlled path argument." },
    { level: "medium", reason: "tool-controlled-path", description: "A filesystem call appears to take a tool-controlled path argument." },
    { level: "medium", reason: "broad-operation-with-non-literal-path", description: "A broad filesystem operation uses a non-literal path even without explicit tool-input evidence." }
  ],
  confidenceLevels: ["medium", "high"],
  confidenceReasons: [
    "recursive-filesystem-operation",
    "root-or-home-directory-path",
    "broad-operation-with-tool-controlled-path",
    "tool-controlled-path",
    "broad-operation-with-non-literal-path"
  ],
  defaultSeverity: "high",
  id: "mcp/broad-filesystem",
  title: "Filesystem access using broad or tool-controlled paths detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      const analysis = analyzeSourceFile(file);
      for (const call of analysis.calls) {
        const filesystem = classifyFilesystemCall(analysis, call);
        if (filesystem === null) {
          continue;
        }

        const argumentText = callArgumentText(analysis, call);
        const reason = classifyFilesystemConfidenceReason(
          filesystem.operation,
          argumentText,
          isLiteralLikeExpression(call.arguments[0])
        );
        if (reason === null) {
          continue;
        }

        findings.push(createFinding({
          ruleId: "mcp/broad-filesystem",
          severity: "high",
          confidence: isHighConfidence(reason) ? "high" : "medium",
          confidenceReason: reason,
          title: broadFilesystemRule.title,
          file: file.relativePath,
          line: call.lineIndex + 1,
          evidence: snippetFrom(file, call.lineIndex, 2),
          whyItMatters: "Filesystem operations that reach tool-controlled or overly broad paths can expose local secrets, modify unrelated files, or touch sensitive host paths.",
          remediation: "Constrain filesystem access to explicit roots, reject absolute or home-directory paths, and avoid recursive destructive operations."
        }));
      }
    }

    return findings;
  }
};

function classifyFilesystemConfidenceReason(
  operation: string,
  argumentText: string,
  literalFirstArgument: boolean
): string | null {
  const broadOperation = BROAD_OPERATIONS.has(operation);
  if (RECURSIVE_PATTERN.test(argumentText)) return "recursive-filesystem-operation";
  if (ROOT_PATH_PATTERN.test(argumentText)) return "root-or-home-directory-path";
  if (broadOperation && USER_PATH_PATTERN.test(argumentText)) return "broad-operation-with-tool-controlled-path";
  if (USER_PATH_PATTERN.test(argumentText)) return "tool-controlled-path";
  if (broadOperation && !literalFirstArgument) return "broad-operation-with-non-literal-path";
  return null;
}

function isHighConfidence(reason: string): boolean {
  return reason === "recursive-filesystem-operation" ||
    reason === "root-or-home-directory-path" ||
    reason === "broad-operation-with-tool-controlled-path";
}
