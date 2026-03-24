#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { auditTarget as defaultAuditTarget } from "../core/audit.js";
import type { AuditReport, Severity } from "../core/types.js";
import { renderJsonReport } from "../renderers/json.js";
import { renderTextReport } from "../renderers/text.js";

type OutputFormat = "json" | "text";

interface OutputWriter {
  write(chunk: string): unknown;
}

interface CliOptions {
  target: string;
  format: OutputFormat;
  failOn?: Severity;
}

interface CliDependencies {
  auditTarget?: typeof defaultAuditTarget;
  stdout?: OutputWriter;
  stderr?: OutputWriter;
}

const SEVERITY_LEVELS: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2
};

export async function runCli(argv: string[], dependencies: CliDependencies = {}): Promise<number> {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const auditTarget = dependencies.auditTarget ?? defaultAuditTarget;

  try {
    const parsed = parseArguments(argv);

    if (parsed === null) {
      stdout.write(`${usage()}\n`);
      return 0;
    }

    const report = await auditTarget(parsed.target);
    const output = parsed.format === "json" ? renderJsonReport(report) : renderTextReport(report);
    stdout.write(`${output}\n`);
    return shouldFailForThreshold(report, parsed.failOn) ? 2 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`TrustMCP error: ${message}\n`);
    return 1;
  }
}

export function parseArguments(argv: string[]): CliOptions | null {
  const args = argv[0] === "scan" ? argv.slice(1) : [...argv];
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return null;
  }

  let format: OutputFormat = "text";
  let target: string | undefined;
  let failOn: Severity | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      format = "json";
      continue;
    }

    if (argument === "--format") {
      const nextArgument = args[index + 1];
      if (nextArgument !== "json" && nextArgument !== "text") {
        throw new Error("--format expects either 'text' or 'json'.");
      }

      format = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--format=")) {
      const value = argument.slice("--format=".length);
      if (value !== "json" && value !== "text") {
        throw new Error("--format expects either 'text' or 'json'.");
      }

      format = value;
      continue;
    }

    if (argument === "--fail-on") {
      const nextArgument = args[index + 1];
      if (!isSeverity(nextArgument)) {
        throw new Error("--fail-on expects one of: low, medium, high.");
      }

      failOn = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--fail-on=")) {
      const value = argument.slice("--fail-on=".length);
      if (!isSeverity(value)) {
        throw new Error("--fail-on expects one of: low, medium, high.");
      }

      failOn = value;
      continue;
    }

    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (target !== undefined) {
      throw new Error("TrustMCP accepts exactly one target: a local directory or a public GitHub repository URL.");
    }

    target = argument;
  }

  if (target === undefined) {
    throw new Error("Missing target. Provide a local directory or a public GitHub repository URL.");
  }

  return failOn === undefined ? { target, format } : { target, format, failOn };
}

function usage(): string {
  return [
    "TrustMCP v0.1.0",
    "Usage:",
    "  trustmcp <target> [--format text|json] [--fail-on low|medium|high]",
    "  trustmcp scan <target> [--format text|json] [--fail-on low|medium|high]",
    "",
    "Targets:",
    "  - local directory",
    "  - public GitHub repository URL"
  ].join("\n");
}

function shouldFailForThreshold(report: AuditReport, failOn?: Severity): boolean {
  if (failOn === undefined) {
    return false;
  }

  const thresholdLevel = SEVERITY_LEVELS[failOn];
  return report.findings.some((finding) => SEVERITY_LEVELS[finding.severity] >= thresholdLevel);
}

function isSeverity(value: string | undefined): value is Severity {
  return value === "low" || value === "medium" || value === "high";
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
