import { appendFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { auditTarget as defaultAuditTarget } from "../core/audit.js";
import { shouldFailForThreshold } from "../core/thresholds.js";
import type { AuditReport, Severity } from "../core/types.js";
import { renderMarkdownReport } from "../renderers/markdown.js";
import { isOutputFormat, renderReport, type OutputFormat } from "../renderers/output.js";
import { writeRenderedOutput } from "../utils/write-rendered-output.js";
import { loadCliConfig, type CliConfig } from "../cli/config.js";

interface OutputWriter {
  write(chunk: string): unknown;
}

interface ActionOptions {
  target: string;
  format?: OutputFormat;
  failOn?: Severity;
  outputFile?: string;
  configFile?: string;
}

interface ActionDependencies {
  auditTarget?: typeof defaultAuditTarget;
  stdout?: OutputWriter;
  stderr?: OutputWriter;
  githubOutputPath?: string;
  githubStepSummaryPath?: string;
  workspaceDir?: string;
}

export async function runAction(
  options: ActionOptions,
  dependencies: ActionDependencies = {}
): Promise<number> {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const auditTarget = dependencies.auditTarget ?? defaultAuditTarget;

  try {
    const workspaceDir = dependencies.workspaceDir ?? process.env.GITHUB_WORKSPACE ?? process.cwd();
    const config = await loadActionConfig(options, workspaceDir);
    const resolved = resolveActionOptions(options, config);

    const report = await auditTarget(resolved.target, {
      ...(resolved.ignoreRules === undefined ? {} : { ignoreRules: resolved.ignoreRules }),
      ...(resolved.ignorePaths === undefined ? {} : { ignorePaths: resolved.ignorePaths })
    });

    const output = renderReport(report, resolved.format);
    await writeRenderedOutput(output, resolved.outputFile);
    stdout.write(`${output}\n`);
    await writeActionOutputs(report, dependencies.githubOutputPath ?? process.env.GITHUB_OUTPUT);
    await writeActionSummary(report, dependencies.githubStepSummaryPath ?? process.env.GITHUB_STEP_SUMMARY);
    return shouldFailForThreshold(report, resolved.failOn) ? 2 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`TrustMCP action error: ${message}\n`);
    return 1;
  }
}

export async function writeActionOutputs(report: AuditReport, githubOutputPath?: string): Promise<void> {
  if (githubOutputPath === undefined || githubOutputPath.length === 0) {
    return;
  }

  const outputLines = [
    `finding-count=${report.summary.findingCount}`,
    `low-count=${report.summary.severityCounts.low}`,
    `medium-count=${report.summary.severityCounts.medium}`,
    `high-count=${report.summary.severityCounts.high}`
  ];

  await appendFile(githubOutputPath, `${outputLines.join("\n")}\n`);
}

export async function writeActionSummary(report: AuditReport, githubStepSummaryPath?: string): Promise<void> {
  if (githubStepSummaryPath === undefined || githubStepSummaryPath.length === 0) {
    return;
  }

  await appendFile(githubStepSummaryPath, `${renderMarkdownReport(report)}\n`);
}

function parseActionArguments(argv: string[]): ActionOptions {
  if (argv.length < 2) {
    throw new Error("Action runner expects at least <target> and <format> arguments.");
  }

  const target = argv[0];
  const rawFormat = argv[1];
  const failOn = argv[2];
  const outputFile = argv[3];
  const configFile = argv[4];

  if (target === undefined || rawFormat === undefined) {
    throw new Error("Action runner expects at least <target> and <format> arguments.");
  }

  if (rawFormat !== "" && !isOutputFormat(rawFormat)) {
    throw new Error("Action runner expects format to be 'text', 'json', 'markdown', or 'sarif'.");
  }

  if (failOn !== undefined && failOn !== "" && failOn !== "low" && failOn !== "medium" && failOn !== "high") {
    throw new Error("Action runner expects fail-on to be 'low', 'medium', or 'high' when provided.");
  }

  const options: ActionOptions = { target };

  if (rawFormat !== "") {
    options.format = rawFormat;
  }

  if (failOn !== undefined && failOn !== "") {
    options.failOn = failOn;
  }

  if (outputFile !== undefined && outputFile !== "") {
    options.outputFile = outputFile;
  }

  if (configFile !== undefined && configFile !== "") {
    options.configFile = configFile;
  }

  return options;
}

type ResolvedActionOptions = {
  target: string;
  format: OutputFormat;
  failOn?: Severity;
  outputFile?: string;
  ignoreRules?: string[];
  ignorePaths?: string[];
};

async function loadActionConfig(options: ActionOptions, workspaceDir: string): Promise<CliConfig> {
  if (options.configFile === undefined) {
    return {};
  }

  const configPath = resolveConfigPath(options.configFile, workspaceDir);
  return loadCliConfig(configPath);
}

function resolveConfigPath(configFile: string, workspaceDir: string): string {
  return isAbsolute(configFile) ? configFile : resolve(workspaceDir, configFile);
}

function resolveActionOptions(options: ActionOptions, config: CliConfig): ResolvedActionOptions {
  const resolvedFormat = options.format ?? config.format ?? "json";
  const resolvedOutputFile = options.outputFile ?? resolveWorkspaceRelativePath(config.outputFile);
  const resolved: ResolvedActionOptions = {
    target: options.target,
    format: resolvedFormat
  };

  const resolvedFailOn = options.failOn ?? config.failOn;
  if (resolvedFailOn !== undefined) {
    resolved.failOn = resolvedFailOn;
  }

  if (resolvedOutputFile !== undefined) {
    resolved.outputFile = resolvedOutputFile;
  }

  if (config.ignoreRules !== undefined) {
    resolved.ignoreRules = config.ignoreRules;
  }

  if (config.ignorePaths !== undefined) {
    resolved.ignorePaths = config.ignorePaths;
  }

  return resolved;
}

function resolveWorkspaceRelativePath(filePath?: string): string | undefined {
  if (filePath === undefined || filePath.length === 0 || isAbsolute(filePath)) {
    return filePath;
  }

  const workspaceRoot = process.env.GITHUB_WORKSPACE;
  if (workspaceRoot === undefined || workspaceRoot.length === 0) {
    return filePath;
  }

  return resolve(workspaceRoot, filePath);
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const options = parseActionArguments(process.argv.slice(2));
  void runAction(options).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
