import { appendFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { auditTarget as defaultAuditTarget } from "../core/audit.js";
import { shouldFailForThreshold } from "../core/thresholds.js";
import type { AuditReport, Severity } from "../core/types.js";
import { renderMarkdownReport } from "../renderers/markdown.js";
import { isOutputFormat, renderReport, renderSummaryReport, type OutputFormat } from "../renderers/output.js";
import { writeRenderedOutput } from "../utils/write-rendered-output.js";
import { loadBaselineEntries, loadCliConfig, type CliConfig } from "../cli/config.js";
import { validateCliOptionCompatibility } from "../cli/validate-cli-options.js";
import { findingsToBaselineEntries } from "../core/baseline-entries.js";
import { writeBaselineFile } from "../utils/baseline-output.js";

interface OutputWriter {
  write(chunk: string): unknown;
}

interface ActionOptions {
  target: string;
  format?: OutputFormat;
  failOn?: Severity;
  outputFile?: string;
  baselineOutput?: string;
  configFile?: string;
  summaryOnly?: boolean;
  baselineFile?: string;
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
    const { config, configPath } = await loadActionConfig(options, workspaceDir);
    const configBaseDir = configPath === undefined ? workspaceDir : dirname(configPath);
    const resolved = resolveActionOptions(options, config, workspaceDir, configBaseDir);
    const resolvedTarget = resolveActionTarget(resolved.target, workspaceDir);
    const compatibilityOptions: Parameters<typeof validateCliOptionCompatibility>[0] = { format: resolved.format };
    if (resolved.summaryOnly !== undefined) {
      compatibilityOptions.summaryOnly = resolved.summaryOnly;
    }
    validateCliOptionCompatibility(compatibilityOptions, "action inputs");

    const baselineEntries = await loadBaselineEntries(resolved.baselineFile, configBaseDir);
    const auditOptions = {
      ...(resolved.ignoreRules === undefined ? {} : { ignoreRules: resolved.ignoreRules }),
      ...(resolved.ignorePaths === undefined ? {} : { ignorePaths: resolved.ignorePaths }),
      ...(baselineEntries === undefined ? {} : { baselineEntries })
    };

    const report = await auditTarget(resolvedTarget, auditOptions);

    const output = resolved.summaryOnly ? renderSummaryReport(report, resolved.format) : renderReport(report, resolved.format);
    await writeRenderedOutput(output, resolved.outputFile);
    if (resolved.baselineOutput !== undefined) {
      await writeBaselineFile(resolved.baselineOutput, findingsToBaselineEntries(report.findings));
    }
    stdout.write(`${output}\n`);
    await writeActionOutputs(
      report,
      baselineEntries !== undefined,
      dependencies.githubOutputPath ?? process.env.GITHUB_OUTPUT
    );
    await writeActionSummary(report, dependencies.githubStepSummaryPath ?? process.env.GITHUB_STEP_SUMMARY);
    return shouldFailForThreshold(report, resolved.failOn) ? 2 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`TrustMCP action error: ${message}\n`);
    return 1;
  }
}

export async function writeActionOutputs(
  report: AuditReport,
  baselineApplied: boolean,
  githubOutputPath?: string
): Promise<void> {
  if (githubOutputPath === undefined || githubOutputPath.length === 0) {
    return;
  }

  const outputLines = [
    `finding-count=${report.summary.findingCount}`,
    `rule-count=${report.summary.triggeredRuleCount}`,
    `low-count=${report.summary.severityCounts.low}`,
    `medium-count=${report.summary.severityCounts.medium}`,
    `high-count=${report.summary.severityCounts.high}`,
    `new-finding-count=${report.summary.newFindingCount}`,
    `new-rule-count=${report.summary.newTriggeredRuleCount}`,
    `new-low-count=${report.summary.newSeverityCounts.low}`,
    `new-medium-count=${report.summary.newSeverityCounts.medium}`,
    `new-high-count=${report.summary.newSeverityCounts.high}`,
    `gated-finding-count=${report.summary.gatedFindingCount}`,
    `gated-rule-count=${report.summary.gatedTriggeredRuleCount}`,
    `gated-low-count=${report.summary.gatedSeverityCounts.low}`,
    `gated-medium-count=${report.summary.gatedSeverityCounts.medium}`,
    `gated-high-count=${report.summary.gatedSeverityCounts.high}`,
    `baseline-applied=${baselineApplied ? "true" : "false"}`,
    `summary-message=${sanitizeGitHubOutputValue(report.summary.message)}`
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
  const baselineOutputArg = argv[4];
  const configFile = argv[5];
  const summaryOnlyArg = argv[6];
  const baselineFileArg = argv[7];

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

  if (baselineOutputArg !== undefined && baselineOutputArg !== "") {
    options.baselineOutput = baselineOutputArg;
  }

  if (configFile !== undefined && configFile !== "") {
    options.configFile = configFile;
  }

  if (summaryOnlyArg !== undefined && summaryOnlyArg !== "") {
    if (summaryOnlyArg !== "true" && summaryOnlyArg !== "false") {
      throw new Error("Action runner expects summary-only to be true or false when provided.");
    }

    options.summaryOnly = summaryOnlyArg === "true";
  }

  if (baselineFileArg !== undefined && baselineFileArg !== "") {
    options.baselineFile = baselineFileArg;
  }

  return options;
}

type ResolvedActionOptions = {
  target: string;
  format: OutputFormat;
  failOn?: Severity;
  outputFile?: string;
  baselineOutput?: string;
  ignoreRules?: string[];
  ignorePaths?: string[];
  summaryOnly?: boolean;
  baselineFile?: string;
};

async function loadActionConfig(
  options: ActionOptions,
  workspaceDir: string
): Promise<{ config: CliConfig; configPath?: string }> {
  if (options.configFile === undefined) {
    return { config: {} };
  }

  const configPath = resolveConfigPath(options.configFile, workspaceDir);
  const config = await loadCliConfig(configPath);
  return { config, configPath };
}

function resolveConfigPath(configFile: string, workspaceDir: string): string {
  return isAbsolute(configFile) ? configFile : resolve(workspaceDir, configFile);
}

function resolveActionOptions(
  options: ActionOptions,
  config: CliConfig,
  workspaceDir: string,
  configBaseDir: string
): ResolvedActionOptions {
  const resolvedFormat = options.format ?? config.format ?? "json";
  const resolvedOutputFile = resolveWorkspaceRelativePath(options.outputFile ?? config.outputFile, workspaceDir);
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

  const resolvedBaselineOutput = resolveActionConfigRelativePath(
    options.baselineOutput ?? config.baselineOutput,
    configBaseDir
  );
  if (resolvedBaselineOutput !== undefined) {
    resolved.baselineOutput = resolvedBaselineOutput;
  }

  if (config.ignoreRules !== undefined) {
    resolved.ignoreRules = config.ignoreRules;
  }

  if (config.ignorePaths !== undefined) {
    resolved.ignorePaths = config.ignorePaths;
  }

  const baselineFile = resolveActionConfigRelativePath(
    options.baselineFile ?? config.baselineFile,
    configBaseDir
  );
  if (baselineFile !== undefined) {
    resolved.baselineFile = baselineFile;
  }

  const resolvedSummaryOnly = options.summaryOnly ?? config.summaryOnly;
  if (resolvedSummaryOnly !== undefined) {
    resolved.summaryOnly = resolvedSummaryOnly;
  }

  return resolved;
}

function resolveWorkspaceRelativePath(filePath: string | undefined, workspaceDir: string): string | undefined {
  if (filePath === undefined || filePath.length === 0 || isAbsolute(filePath)) {
    return filePath;
  }

  return resolve(workspaceDir, filePath);
}

function resolveActionConfigRelativePath(
  filePath: string | undefined,
  configBaseDir: string
): string | undefined {
  if (filePath === undefined || filePath.length === 0 || isAbsolute(filePath)) {
    return filePath;
  }

  return resolve(configBaseDir, filePath);
}

function resolveActionTarget(target: string, workspaceDir: string): string {
  if (target.startsWith("gh:") || target.startsWith("http://") || target.startsWith("https://") || isAbsolute(target)) {
    return target;
  }

  return resolve(workspaceDir, target);
}

function sanitizeGitHubOutputValue(value: string): string {
  return value.replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const options = parseActionArguments(process.argv.slice(2));
  void runAction(options).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
