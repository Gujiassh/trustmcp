#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { auditTarget as defaultAuditTarget } from "../core/audit.js";
import { isSeverity, shouldFailForThreshold } from "../core/thresholds.js";
import type { Severity } from "../core/types.js";
import { loadCliConfig, type CliConfig } from "./config.js";
import { runDoctor } from "./doctor.js";
import { DEFAULT_CONFIG_PATH, writeStarterConfig } from "./init-config.js";
import { renderRuleList } from "./list-rules.js";
import { isOutputFormat, renderReport, renderSummaryReport, type OutputFormat } from "../renderers/output.js";
import { writeRenderedOutput } from "../utils/write-rendered-output.js";

interface OutputWriter {
  write(chunk: string): unknown;
}

interface CliOptions {
  target: string;
  format: OutputFormat;
  failOn?: Severity;
  outputFile?: string;
  summaryOnly?: boolean;
}

interface ParsedCliArguments {
  target: string;
  format?: OutputFormat;
  failOn?: Severity;
  outputFile?: string;
  summaryOnly?: boolean;
  configFile?: string;
}

interface InitConfigCliArguments {
  initConfig: true;
  outputPath: string;
}

interface DoctorCliArguments {
  doctor: true;
  target: string;
  configFile?: string;
}

interface ListRulesCliArguments {
  listRules: true;
}

type ParsedCommand = ParsedCliArguments | InitConfigCliArguments | DoctorCliArguments | ListRulesCliArguments;

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

    if (isInitConfigCommand(parsed)) {
      await writeStarterConfig(parsed.outputPath);
      stdout.write(`Wrote starter config to ${parsed.outputPath}\n`);
      return 0;
    }

    if (isDoctorCommand(parsed)) {
      const result = await runDoctor(
        parsed.configFile === undefined
          ? { target: parsed.target }
          : { target: parsed.target, configFile: parsed.configFile }
      );
      stdout.write(`${result.output}\n`);
      return result.ok ? 0 : 1;
    }

    if (isListRulesCommand(parsed)) {
      stdout.write(`${renderRuleList()}\n`);
      return 0;
    }

    const config = await loadCliConfig(parsed.configFile);
    const resolved = resolveCliOptions(parsed, config);

    const report = await auditTarget(resolved.target);
    const output = resolved.summaryOnly ? renderSummaryReport(report, resolved.format) : renderReport(report, resolved.format);

    await writeRenderedOutput(output, resolved.outputFile);

    stdout.write(`${output}\n`);
    return shouldFailForThreshold(report, resolved.failOn) ? 2 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`TrustMCP error: ${message}\n`);
    return 1;
  }
}

export function parseArguments(argv: string[]): ParsedCommand | null {
  if (argv[0] === "init-config") {
    return parseInitConfigArguments(argv.slice(1));
  }

  if (argv[0] === "doctor") {
    return parseDoctorArguments(argv.slice(1));
  }

  if (argv[0] === "list-rules") {
    return parseListRulesArguments(argv.slice(1));
  }

  const args = argv[0] === "scan" ? argv.slice(1) : [...argv];
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return null;
  }

  let format: OutputFormat | undefined;
  let target: string | undefined;
  let failOn: Severity | undefined;
  let outputFile: string | undefined;
  let summaryOnly: boolean | undefined;
  let configFile: string | undefined;

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
        throw new Error("--format expects one of: text, json, markdown, sarif.");
      }

      format = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--format=")) {
      const value = argument.slice("--format=".length);
      if (!isOutputFormat(value)) {
        throw new Error("--format expects one of: text, json, markdown, sarif.");
      }

      format = value;
      continue;
    }

    if (argument === "--config") {
      const nextArgument = args[index + 1];
      if (nextArgument === undefined || nextArgument.startsWith("-")) {
        throw new Error("--config expects a file path.");
      }

      configFile = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--config=")) {
      const value = argument.slice("--config=".length);
      if (value.length === 0) {
        throw new Error("--config expects a file path.");
      }

      configFile = value;
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

    if (argument === "--summary-only") {
      summaryOnly = true;
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

  const options: ParsedCliArguments = { target };

  if (format !== undefined) {
    options.format = format;
  }

  if (failOn !== undefined) {
    options.failOn = failOn;
  }

  if (outputFile !== undefined) {
    options.outputFile = outputFile;
  }

  if (summaryOnly) {
    options.summaryOnly = true;
  }

  if (configFile !== undefined) {
    options.configFile = configFile;
  }

  return options;
}

function parseInitConfigArguments(argv: string[]): InitConfigCliArguments | null {
  if (argv.length === 0) {
    return {
      initConfig: true,
      outputPath: DEFAULT_CONFIG_PATH
    };
  }

  if (argv.includes("--help") || argv.includes("-h")) {
    return null;
  }

  let outputPath = DEFAULT_CONFIG_PATH;
  let sawPath = false;

  for (const argument of argv) {
    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (sawPath) {
      throw new Error("init-config accepts at most one optional output path.");
    }

    outputPath = argument;
    sawPath = true;
  }

  return {
    initConfig: true,
    outputPath
  };
}

function parseDoctorArguments(argv: string[]): DoctorCliArguments | null {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return null;
  }

  let target: string | undefined;
  let configFile: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--config") {
      const nextArgument = argv[index + 1];
      if (nextArgument === undefined || nextArgument.startsWith("-")) {
        throw new Error("--config expects a file path.");
      }

      configFile = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--config=")) {
      const value = argument.slice("--config=".length);
      if (value.length === 0) {
        throw new Error("--config expects a file path.");
      }

      configFile = value;
      continue;
    }

    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (target !== undefined) {
      throw new Error("doctor accepts exactly one target: a local directory, GitHub repository URL, or gh:owner/repo.");
    }

    target = argument;
  }

  if (target === undefined) {
    throw new Error("doctor requires a local directory, GitHub repository URL, or gh:owner/repo target.");
  }

  const options: DoctorCliArguments = {
    doctor: true,
    target
  };

  if (configFile !== undefined) {
    options.configFile = configFile;
  }

  return options;
}

function parseListRulesArguments(argv: string[]): ListRulesCliArguments | null {
  if (argv.length === 0) {
    return { listRules: true };
  }

  if (argv.includes("--help") || argv.includes("-h")) {
    return null;
  }

  throw new Error("list-rules does not accept additional arguments.");
}

function isInitConfigCommand(parsed: ParsedCommand): parsed is InitConfigCliArguments {
  return "initConfig" in parsed;
}

function isDoctorCommand(parsed: ParsedCommand): parsed is DoctorCliArguments {
  return "doctor" in parsed;
}

function isListRulesCommand(parsed: ParsedCommand): parsed is ListRulesCliArguments {
  return "listRules" in parsed;
}

export function resolveCliOptions(parsed: ParsedCliArguments, config: CliConfig): CliOptions {
  const options: CliOptions = {
    target: parsed.target,
    format: parsed.format ?? config.format ?? "text"
  };

  const failOn = parsed.failOn ?? config.failOn;
  if (failOn !== undefined) {
    options.failOn = failOn;
  }

  const outputFile = parsed.outputFile ?? config.outputFile;
  if (outputFile !== undefined) {
    options.outputFile = outputFile;
  }

  const summaryOnly = parsed.summaryOnly ?? config.summaryOnly;
  if (summaryOnly === true) {
    options.summaryOnly = true;
  }

  return options;
}

function usage(): string {
  return [
    "TrustMCP v0.1.0",
    "Usage:",
    "  trustmcp <target> [--config path] [--format text|json|markdown|sarif] [--summary-only] [--fail-on low|medium|high] [--output-file path]",
    "  trustmcp scan <target> [--config path] [--format text|json|markdown|sarif] [--summary-only] [--fail-on low|medium|high] [--output-file path]",
    "  trustmcp doctor <target> [--config path]",
    "  trustmcp init-config [path]",
    "  trustmcp list-rules",
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
