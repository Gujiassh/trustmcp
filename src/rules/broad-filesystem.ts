import { createFinding, snippetFrom } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const FS_IMPORT_PATTERN =
  /(?:from\s+["']node:fs["']|from\s+["']fs["']|require\(["']node:fs["']\)|require\(["']fs["']\))/;

const QUALIFIED_FILESYSTEM_CALL_PATTERN =
  /\bfs(?:\.promises)?\.(?:readFile|writeFile|appendFile|rm|rmdir|readdir|opendir|cp|createReadStream|createWriteStream|unlink)\s*\(/;

const IMPORTED_FILESYSTEM_CALL_PATTERN =
  /\b(?:readFile|writeFile|appendFile|rm|rmdir|readdir|opendir|cp|createReadStream|createWriteStream|unlink)\s*\(/;

const BROAD_OPERATION_PATTERN = /\b(?:readdir|opendir|rm|rmdir|cp|createReadStream|createWriteStream)\s*\(/;
const RECURSIVE_PATTERN = /\brecursive\s*:\s*true\b/;
const ROOT_PATH_PATTERN = /process\.env\.(?:HOME|USERPROFILE)|os\.homedir\s*\(|["'`]~\//;
const USER_PATH_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*path\b|\b(?:filePath|dirPath|targetPath|requestedPath|workspacePath|userPath|pathArg)\b/i;

export const broadFilesystemRule: Rule = {
  confidenceGuidance: [
    {
      level: "high",
      reason: "recursive-filesystem-operation",
      description: "A recursive filesystem operation such as rm/cp/readdir with recursive=true was matched."
    },
    {
      level: "high",
      reason: "root-or-home-directory-path",
      description: "The filesystem path reaches HOME, USERPROFILE, os.homedir(), or a tilde-rooted path."
    },
    {
      level: "high",
      reason: "broad-operation-with-tool-controlled-path",
      description: "A broad filesystem operation appears to take a tool-controlled path argument."
    },
    {
      level: "medium",
      reason: "tool-controlled-path",
      description: "A filesystem call appears to take a tool-controlled path argument."
    },
    {
      level: "medium",
      reason: "broad-operation-with-non-literal-path",
      description: "A broad filesystem operation uses a non-literal path even without explicit tool-input evidence."
    }
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
      const hasFsImport = FS_IMPORT_PATTERN.test(file.content);

      file.lines.forEach((line, index) => {
        const hasFilesystemCall =
          QUALIFIED_FILESYSTEM_CALL_PATTERN.test(line) ||
          (hasFsImport && IMPORTED_FILESYSTEM_CALL_PATTERN.test(line));

        if (!hasFilesystemCall) {
          return;
        }

        const evidence = snippetFrom(file, index, 2);
        const confidence = classifyFilesystemConfidence(line, evidence);
        if (confidence === null) {
          return;
        }
        const confidenceReason = classifyFilesystemConfidenceReason(line, evidence);
        if (confidenceReason === null) {
          return;
        }

        findings.push(
          createFinding({
            ruleId: "mcp/broad-filesystem",
            severity: "high",
            confidence,
            confidenceReason,
            title: broadFilesystemRule.title,
            file: file.relativePath,
            line: index + 1,
            evidence,
            whyItMatters:
              "Filesystem operations that reach tool-controlled or overly broad paths can expose local secrets, modify unrelated files, or touch sensitive host paths.",
            remediation:
              "Constrain filesystem access to explicit roots, reject absolute or home-directory paths, and avoid recursive destructive operations."
          })
        );
      });
    }

    return findings;
  }
};

function classifyFilesystemConfidence(line: string, evidence: string): "high" | "medium" | null {
  const reason = classifyFilesystemConfidenceReason(line, evidence);
  if (reason === null) {
    return null;
  }

  if (
    reason === "recursive-filesystem-operation" ||
    reason === "root-or-home-directory-path" ||
    reason === "broad-operation-with-tool-controlled-path"
  ) {
    return "high";
  }

  return "medium";
}

function classifyFilesystemConfidenceReason(line: string, evidence: string): string | null {
  const hasRecursive = RECURSIVE_PATTERN.test(evidence);
  const hasRootPath = ROOT_PATH_PATTERN.test(evidence);
  const hasUserPath = USER_PATH_PATTERN.test(evidence);
  const broadOperation = BROAD_OPERATION_PATTERN.test(line);
  const nonLiteralFirstArgument = hasNonLiteralFirstArgument(line);

  if (hasRecursive) {
    return "recursive-filesystem-operation";
  }

  if (hasRootPath) {
    return "root-or-home-directory-path";
  }

  if (broadOperation && hasUserPath) {
    return "broad-operation-with-tool-controlled-path";
  }

  if (hasUserPath) {
    return "tool-controlled-path";
  }

  if (broadOperation && nonLiteralFirstArgument) {
    return "broad-operation-with-non-literal-path";
  }

  return null;
}

function hasNonLiteralFirstArgument(line: string): boolean {
  const openingParenthesis = line.indexOf("(");
  if (openingParenthesis === -1) {
    return false;
  }

  const afterParenthesis = line.slice(openingParenthesis + 1).trimStart();
  return !afterParenthesis.startsWith("\"") &&
    !afterParenthesis.startsWith("'") &&
    !afterParenthesis.startsWith("`") &&
    !afterParenthesis.startsWith("new URL") &&
    !afterParenthesis.startsWith("import.meta");
}
