import { stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const STARTER_CONFIG = {
  format: "markdown",
  "fail-on": "high",
  "summary-only": false,
  "output-file": "trustmcp-report.md",
  "ignore-rules": [],
  "ignore-paths": [],
  "baseline-file": "trustmcp.baseline.json"
} as const;

export const DEFAULT_CONFIG_PATH = "trustmcp.config.json";

export function renderStarterConfig(): string {
  return `${JSON.stringify(STARTER_CONFIG, null, 2)}\n`;
}

export async function writeStarterConfig(outputPath: string): Promise<void> {
  const outputDirectory = dirname(outputPath);

  let outputDirectoryStats: Awaited<ReturnType<typeof stat>>;
  try {
    outputDirectoryStats = await stat(outputDirectory);
  } catch {
    throw new Error(`Config file directory does not exist: ${outputDirectory}`);
  }

  if (!outputDirectoryStats.isDirectory()) {
    throw new Error(`Config file directory is not a directory: ${outputDirectory}`);
  }

  try {
    await writeFile(outputPath, renderStarterConfig(), { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (hasErrorCode(error, "EEXIST")) {
      throw new Error(`Config file already exists: ${outputPath}`);
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write starter config ${outputPath}: ${message}`);
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
