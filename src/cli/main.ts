#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { auditTarget as defaultAuditTarget } from "../core/audit.js";
import { isSeverity, shouldFailForThreshold } from "../core/thresholds.js";
import type { Severity } from "../core/types.js";
import { isOutputFormat, renderReport, type OutputFormat } from "../renderers/output.js";

interface OutputWriter {
  write(chunk: string): unknown;
}

interface CliOptions {
  target: string;
  format: OutputFormat;
  failOn?: Severity;
  outputFile?: string;
}

interface CliDependencies {
  auditTarget?: typeof defaultAuditTarget;
  stdout?: OutputWriter;
  stderr?: OutputWriter;
}

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
    const output = renderReport(report, parsed.format);

    if (parsed.outputFile !== undefined) {
      await writeFile(parsed.outputFile, `${output}\n`, "utf8");
    }

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
  let outputFile: string | undefined;

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
      if (!isOutputFormat(nextArgument)) {
        throw new Error("--format expects one of: text, json, markdown.");
      }

      format = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--format=")) {
      const value = argument.slice("--format=".length);
      if (!isOutputFormat(value)) {
        throw new Error("--format expects one of: text, json, markdown.");
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

    if (argument === "--output-file") {
      const nextArgument = args[index + 1];
      if (nextArgument === undefined || nextArgument.startsWith("-")) {
        throw new Error("--output-file expects a file path.");
      }

      outputFile = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--output-file=")) {
      const value = argument.slice("--output-file=".length);
      if (value.length === 0) {
        throw new Error("--output-file expects a file path.");
      }

      outputFile = value;
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

  const options: CliOptions = { target, format };

  if (failOn !== undefined) {
    options.failOn = failOn;
  }

  if (outputFile !== undefined) {
    options.outputFile = outputFile;
  }

  return options;
}

function usage(): string {
  return [
    "TrustMCP v0.1.0",
    "Usage:",
    "  trustmcp <target> [--format text|json|markdown] [--fail-on low|medium|high] [--output-file path]",
    "  trustmcp scan <target> [--format text|json|markdown] [--fail-on low|medium|high] [--output-file path]",
    "",
    "Targets:",
    "  - local directory",
    "  - public GitHub repository URL",
    "  - gh:owner/repo"
  ].join("\n");
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
