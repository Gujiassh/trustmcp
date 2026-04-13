import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { isSeverity } from "../core/thresholds.js";
import type { BaselineEntry, Severity } from "../core/types.js";
import { isOutputFormat, type OutputFormat } from "../renderers/output.js";

const SUPPORTED_CONFIG_FIELDS = [
  "format",
  "fail-on",
  "summary-only",
  "output-file",
  "ignore-rules",
  "ignore-paths",
  "baseline-file"
] as const;

export interface CliConfig {
  format?: OutputFormat;
  failOn?: Severity;
  summaryOnly?: boolean;
  outputFile?: string;
  ignoreRules?: string[];
  ignorePaths?: string[];
  baselineFile?: string;
}

export async function loadCliConfig(configFile?: string): Promise<CliConfig> {
  if (configFile === undefined) {
    return {};
  }

  let content: string;
  try {
    content = await readFile(configFile, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config file ${configFile}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Config file ${configFile} must contain valid JSON: ${message}`);
  }

  return validateCliConfig(parsed, configFile);
}

function validateCliConfig(value: unknown, configFile: string): CliConfig {
  if (!isRecord(value)) {
    throw new Error(`Config file ${configFile} must contain a JSON object.`);
  }

  for (const key of Object.keys(value)) {
    if (!SUPPORTED_CONFIG_FIELDS.includes(key as (typeof SUPPORTED_CONFIG_FIELDS)[number])) {
      throw new Error(
        `Unsupported config field '${key}' in ${configFile}. Supported fields: ${SUPPORTED_CONFIG_FIELDS.join(", ")}.`
      );
    }
  }

  const config: CliConfig = {};

  const format = value["format"];
  if (format !== undefined) {
    if (typeof format !== "string" || !isOutputFormat(format)) {
      throw new Error(`Config file ${configFile} has invalid 'format'. Expected one of: text, json, markdown, sarif.`);
    }

    config.format = format;
  }

  const failOn = value["fail-on"];
  if (failOn !== undefined) {
    if (typeof failOn !== "string" || !isSeverity(failOn)) {
      throw new Error(`Config file ${configFile} has invalid 'fail-on'. Expected one of: low, medium, high.`);
    }

    config.failOn = failOn;
  }

  const summaryOnly = value["summary-only"];
  if (summaryOnly !== undefined) {
    if (typeof summaryOnly !== "boolean") {
      throw new Error(`Config file ${configFile} has invalid 'summary-only'. Expected a boolean.`);
    }

    config.summaryOnly = summaryOnly;
  }

  const outputFile = value["output-file"];
  if (outputFile !== undefined) {
    if (typeof outputFile !== "string" || outputFile.length === 0) {
      throw new Error(`Config file ${configFile} has invalid 'output-file'. Expected a non-empty string.`);
    }

    config.outputFile = outputFile;
  }

  const ignoreRules = value["ignore-rules"];
  if (ignoreRules !== undefined) {
    config.ignoreRules = normalizeStringArray(ignoreRules, configFile, "ignore-rules");
  }

  const ignorePaths = value["ignore-paths"];
  if (ignorePaths !== undefined) {
    config.ignorePaths = normalizeStringArray(ignorePaths, configFile, "ignore-paths");
  }

  const baselineFile = value["baseline-file"];
  if (baselineFile !== undefined) {
    if (typeof baselineFile !== "string" || baselineFile.trim().length === 0) {
      throw new Error(`Config file ${configFile} has invalid 'baseline-file'. Expected a file path string.`);
    }

    config.baselineFile = baselineFile.trim();
  }

  return config;
}

function normalizeStringArray(value: unknown, configFile: string, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Config file ${configFile} has invalid '${field}'. Expected an array of non-empty strings.`);
  }

  const normalized: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      throw new Error(`Config file ${configFile} has invalid '${field}'. Expected an array of non-empty strings.`);
    }

    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      throw new Error(`Config file ${configFile} has invalid '${field}'. Expected an array of non-empty strings.`);
    }

    normalized.push(trimmed);
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function loadBaselineEntries(
  baselineFile: string | undefined,
  baseDirectory: string = process.cwd()
): Promise<BaselineEntry[] | undefined> {
  if (baselineFile === undefined || baselineFile.length === 0) {
    return undefined;
  }

  const resolvedPath = isAbsolute(baselineFile) ? baselineFile : resolve(baseDirectory, baselineFile);
  let content: string;
  try {
    content = await readFile(resolvedPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read baseline file ${resolvedPath}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Baseline file ${resolvedPath} must contain valid JSON: ${message}`);
  }

  return validateBaselineEntries(parsed, resolvedPath);
}

function validateBaselineEntries(value: unknown, baselinePath: string): BaselineEntry[] {
  if (!Array.isArray(value)) {
    throw new Error(`Baseline file ${baselinePath} must contain a JSON array of baseline entries.`);
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(
        `Baseline file ${baselinePath}: entry at index ${index} must be an object with ruleId and file.`
      );
    }

    const ruleId = entry.ruleId;
    if (typeof ruleId !== "string" || ruleId.length === 0) {
      throw new Error(
        `Baseline file ${baselinePath}: entry at index ${index} has invalid 'ruleId'. Expected a non-empty string.`
      );
    }

    const file = entry.file;
    if (typeof file !== "string" || file.length === 0) {
      throw new Error(
        `Baseline file ${baselinePath}: entry at index ${index} has invalid 'file'. Expected a non-empty string.`
      );
    }

    const line = entry.line;
    if (line !== undefined && (typeof line !== "number" || !Number.isInteger(line) || line <= 0)) {
      throw new Error(
        `Baseline file ${baselinePath}: entry at index ${index} has invalid 'line'. Expected a positive integer.`
      );
    }

    return {
      ruleId,
      file,
      ...(line === undefined ? {} : { line })
    };
  });
}
