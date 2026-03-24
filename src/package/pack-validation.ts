export interface PackFileEntry {
  path: string;
}

export interface PackSummary {
  files: PackFileEntry[];
}

export interface PackValidationResult {
  fileCount: number;
  includedPaths: string[];
}

const REQUIRED_PACK_FILES = ["LICENSE", "README.md", "package.json", "dist/cli/main.js", "dist/index.js", "dist/index.d.ts"];

export function isAllowedPackFilePath(filePath: string): boolean {
  return filePath === "LICENSE" ||
    filePath === "README.md" ||
    filePath === "package.json" ||
    /^dist\/.+(?:\.js|\.d\.ts)$/.test(filePath);
}

export function validatePackSummary(value: unknown): PackValidationResult {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error("npm pack validation expected exactly one package summary.");
  }

  const [summary] = value;
  if (!isPackSummary(summary)) {
    throw new Error("npm pack validation expected a package summary with a files array.");
  }

  const includedPaths = summary.files.map((file) => file.path);

  const unexpectedFiles = includedPaths.filter((filePath) => !isAllowedPackFilePath(filePath));
  if (unexpectedFiles.length > 0) {
    throw new Error(`Unexpected files in npm pack output: ${unexpectedFiles.join(", ")}`);
  }

  const missingFiles = REQUIRED_PACK_FILES.filter((filePath) => !includedPaths.includes(filePath));
  if (missingFiles.length > 0) {
    throw new Error(`Missing required files in npm pack output: ${missingFiles.join(", ")}`);
  }

  return {
    fileCount: includedPaths.length,
    includedPaths
  };
}

function isPackSummary(value: unknown): value is PackSummary {
  return typeof value === "object" && value !== null && "files" in value && Array.isArray(value.files) &&
    value.files.every(isPackFileEntry);
}

function isPackFileEntry(value: unknown): value is PackFileEntry {
  return typeof value === "object" && value !== null && "path" in value && typeof value.path === "string";
}
