import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { auditTarget as defaultAuditTarget } from "../core/audit.js";
import { shouldFailForThreshold } from "../core/thresholds.js";
import type { AuditReport, Severity } from "../core/types.js";
import { renderMarkdownReport } from "../renderers/markdown.js";
import { isOutputFormat, renderReport, type OutputFormat } from "../renderers/output.js";

interface OutputWriter {
  write(chunk: string): unknown;
}

interface ActionOptions {
  target: string;
  format: OutputFormat;
  failOn?: Severity;
}

interface ActionDependencies {
  auditTarget?: typeof defaultAuditTarget;
  stdout?: OutputWriter;
  stderr?: OutputWriter;
  githubOutputPath?: string;
  githubStepSummaryPath?: string;
}

export async function runAction(
  options: ActionOptions,
  dependencies: ActionDependencies = {}
): Promise<number> {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const auditTarget = dependencies.auditTarget ?? defaultAuditTarget;

  try {
    const report = await auditTarget(options.target);
    const output = renderReport(report, options.format);
    stdout.write(`${output}\n`);
    await writeActionOutputs(report, dependencies.githubOutputPath ?? process.env.GITHUB_OUTPUT);
    await writeActionSummary(report, dependencies.githubStepSummaryPath ?? process.env.GITHUB_STEP_SUMMARY);
    return shouldFailForThreshold(report, options.failOn) ? 2 : 0;
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
  const format = argv[1];
  const failOn = argv[2];

  if (target === undefined || format === undefined) {
    throw new Error("Action runner expects at least <target> and <format> arguments.");
  }

  if (!isOutputFormat(format)) {
    throw new Error("Action runner expects format to be 'text', 'json', or 'markdown'.");
  }

  if (failOn !== undefined && failOn !== "" && failOn !== "low" && failOn !== "medium" && failOn !== "high") {
    throw new Error("Action runner expects fail-on to be 'low', 'medium', or 'high' when provided.");
  }

  return failOn === undefined || failOn === "" ? { target, format } : { target, format, failOn };
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const options = parseActionArguments(process.argv.slice(2));
  void runAction(options).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
