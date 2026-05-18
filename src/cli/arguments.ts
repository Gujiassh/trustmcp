import { isSeverity } from "../core/thresholds.js";
import type { Severity } from "../core/types.js";
import { TRUSTMCP_VERSION } from "../core/version.js";
import type { CliConfig } from "./config.js";
import type { DoctorFormat } from "./doctor.js";
import { DEFAULT_CONFIG_PATH } from "./init-config.js";
import type { RuleListFormat } from "./list-rules.js";
import { isOutputFormat, type OutputFormat } from "../renderers/output.js";

export interface CliOptions {
  target: string;
  format: OutputFormat;
  failOn?: Severity;
  outputFile?: string;
  baselineOutput?: string;
  summaryOnly?: boolean;
  ignoreRules?: string[];
  ignorePaths?: string[];
  baselineFile?: string;
}

export interface ParsedCliArguments {
  target: string;
  format?: OutputFormat;
  failOn?: Severity;
  outputFile?: string;
  summaryOnly?: boolean;
  configFile?: string;
  baselineFile?: string;
  baselineOutput?: string;
}

export interface InitConfigCliArguments {
  initConfig: true;
  outputPath: string;
}

export interface DoctorCliArguments {
  doctor: true;
  format: DoctorFormat;
  target: string;
  configFile?: string;
  outputFile?: string;
}

export interface ListRulesCliArguments {
  listRules: true;
  format: RuleListFormat;
  outputFile?: string;
}

export interface VersionCliArguments {
  version: true;
}

export type ParsedCommand = ParsedCliArguments | InitConfigCliArguments | DoctorCliArguments | ListRulesCliArguments | VersionCliArguments;


function isBlankPath(value: string): boolean {
  return value.trim().length === 0;
}

export function parseArguments(argv: string[]): ParsedCommand | null {
  if (argv[0] === "--version" || argv[0] === "-v" || argv[0] === "version") {
    return parseVersionArguments(argv.slice(1));
  }

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
  let baselineFile: string | undefined;
  let baselineOutput: string | undefined;

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
      if (nextArgument === undefined || nextArgument.startsWith("-") || isBlankPath(nextArgument)) {
        throw new Error("--config expects a file path.");
      }

      configFile = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--config=")) {
      const value = argument.slice("--config=".length);
      if (value.length === 0 || isBlankPath(value)) {
        throw new Error("--config expects a file path.");
      }

      configFile = value;
      continue;
    }

    if (argument === "--baseline-file") {
      const nextArgument = args[index + 1];
      if (nextArgument === undefined || nextArgument.startsWith("-") || isBlankPath(nextArgument)) {
        throw new Error("--baseline-file expects a file path.");
      }

      baselineFile = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--baseline-file=")) {
      const value = argument.slice("--baseline-file=".length);
      if (value.length === 0 || isBlankPath(value)) {
        throw new Error("--baseline-file expects a file path.");
      }

      baselineFile = value;
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
      if (nextArgument === undefined || nextArgument.startsWith("-") || isBlankPath(nextArgument)) {
        throw new Error("--output-file expects a file path.");
      }

      outputFile = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--output-file=")) {
      const value = argument.slice("--output-file=".length);
      if (value.length === 0 || isBlankPath(value)) {
        throw new Error("--output-file expects a file path.");
      }

      outputFile = value;
      continue;
    }

    if (argument === "--baseline-output") {
      const nextArgument = args[index + 1];
      if (nextArgument === undefined || nextArgument.startsWith("-") || isBlankPath(nextArgument)) {
        throw new Error("--baseline-output expects a file path.");
      }

      baselineOutput = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--baseline-output=")) {
      const value = argument.slice("--baseline-output=".length);
      if (value.length === 0 || isBlankPath(value)) {
        throw new Error("--baseline-output expects a file path.");
      }

      baselineOutput = value;
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

    if (isBlankPath(argument)) {
      throw new Error("Target must not be blank. Provide a local directory or a public GitHub repository URL.");
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

  if (baselineFile !== undefined) {
    options.baselineFile = baselineFile;
  }

  if (baselineOutput !== undefined) {
    options.baselineOutput = baselineOutput;
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

  let format: DoctorFormat = "text";
  let target: string | undefined;
  let configFile: string | undefined;
  let outputFile: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--config") {
      const nextArgument = argv[index + 1];
      if (nextArgument === undefined || nextArgument.startsWith("-") || isBlankPath(nextArgument)) {
        throw new Error("--config expects a file path.");
      }

      configFile = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--config=")) {
      const value = argument.slice("--config=".length);
      if (value.length === 0 || isBlankPath(value)) {
        throw new Error("--config expects a file path.");
      }

      configFile = value;
      continue;
    }

    if (argument === "--output-file") {
      const nextArgument = argv[index + 1];
      if (nextArgument === undefined || nextArgument.startsWith("-") || isBlankPath(nextArgument)) {
        throw new Error("doctor --output-file expects a file path.");
      }

      outputFile = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--output-file=")) {
      const value = argument.slice("--output-file=".length);
      if (value.length === 0 || isBlankPath(value)) {
        throw new Error("doctor --output-file expects a file path.");
      }

      outputFile = value;
      continue;
    }

    if (argument === "--json") {
      format = "json";
      continue;
    }

    if (argument === "--format") {
      const nextArgument = argv[index + 1];
      if (nextArgument !== "text" && nextArgument !== "json") {
        throw new Error("doctor --format expects one of: text, json.");
      }

      format = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--format=")) {
      const value = argument.slice("--format=".length);
      if (value !== "text" && value !== "json") {
        throw new Error("doctor --format expects one of: text, json.");
      }

      format = value;
      continue;
    }

    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (target !== undefined) {
      throw new Error("doctor accepts exactly one target: a local directory, GitHub repository URL, or gh:owner/repo, optionally with an explicit ref.");
    }

    if (isBlankPath(argument)) {
      throw new Error("doctor target must not be blank.");
    }

    target = argument;
  }

  if (target === undefined) {
    throw new Error("doctor requires a local directory, GitHub repository URL, or gh:owner/repo target, optionally with an explicit ref.");
  }

  const options: DoctorCliArguments = {
    doctor: true,
    format,
    target
  };

  if (configFile !== undefined) {
    options.configFile = configFile;
  }

  if (outputFile !== undefined) {
    options.outputFile = outputFile;
  }

  return options;
}

function parseListRulesArguments(argv: string[]): ListRulesCliArguments | null {
  if (argv.length === 0) {
    return { listRules: true, format: "tsv" };
  }

  if (argv.includes("--help") || argv.includes("-h")) {
    return null;
  }

  let format: RuleListFormat = "tsv";
  let outputFile: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      format = "json";
      continue;
    }

    if (argument === "--format") {
      const nextArgument = argv[index + 1];
      if (nextArgument !== "json" && nextArgument !== "tsv") {
        throw new Error("list-rules --format expects one of: tsv, json.");
      }

      format = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--format=")) {
      const value = argument.slice("--format=".length);
      if (value !== "json" && value !== "tsv") {
        throw new Error("list-rules --format expects one of: tsv, json.");
      }

      format = value;
      continue;
    }

    if (argument === "--output-file") {
      const nextArgument = argv[index + 1];
      if (nextArgument === undefined || nextArgument.startsWith("-") || isBlankPath(nextArgument)) {
        throw new Error("list-rules --output-file expects a file path.");
      }

      outputFile = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--output-file=")) {
      const value = argument.slice("--output-file=".length);
      if (value.length === 0 || isBlankPath(value)) {
        throw new Error("list-rules --output-file expects a file path.");
      }

      outputFile = value;
      continue;
    }

    throw new Error("list-rules does not accept additional arguments.");
  }

  const options: ListRulesCliArguments = {
    listRules: true,
    format
  };

  if (outputFile !== undefined) {
    options.outputFile = outputFile;
  }

  return options;
}

function parseVersionArguments(argv: string[]): VersionCliArguments {
  if (argv.length > 0) {
    throw new Error("version does not accept additional arguments.");
  }

  return { version: true };
}

export function isInitConfigCommand(parsed: ParsedCommand): parsed is InitConfigCliArguments {
  return "initConfig" in parsed;
}

export function isDoctorCommand(parsed: ParsedCommand): parsed is DoctorCliArguments {
  return "doctor" in parsed;
}

export function isListRulesCommand(parsed: ParsedCommand): parsed is ListRulesCliArguments {
  return "listRules" in parsed;
}

export function isVersionCommand(parsed: ParsedCommand): parsed is VersionCliArguments {
  return "version" in parsed;
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

  if (config.ignoreRules !== undefined) {
    options.ignoreRules = config.ignoreRules;
  }

  if (config.ignorePaths !== undefined) {
    options.ignorePaths = config.ignorePaths;
  }

  const baselineFile = parsed.baselineFile ?? config.baselineFile;
  if (baselineFile !== undefined) {
    options.baselineFile = baselineFile;
  }

  const baselineOutput = parsed.baselineOutput ?? config.baselineOutput;
  if (baselineOutput !== undefined) {
    options.baselineOutput = baselineOutput;
  }

  return options;
}

export function usage(): string {
  return [
    "TrustMCP v0.2.0-dev",
    "",
    "Run a scan:",
    "  trustmcp <target> [--config path] [--baseline-file path] [--baseline-output path] [--format text|json|markdown|sarif] [--summary-only] [--fail-on low|medium|high] [--output-file path]",
    "  trustmcp scan <target> [--config path] [--baseline-file path] [--baseline-output path] [--format text|json|markdown|sarif] [--summary-only] [--fail-on low|medium|high] [--output-file path]",
    "",
    "Validate first:",
    "  trustmcp doctor <target> [--config path] [--json|--format text|json] [--output-file path]",
    "",
    "Set up locally:",
    "  trustmcp init-config [path]",
    "",
    "Inspect rules:",
    "  trustmcp list-rules [--json|--format tsv|json] [--output-file path]",
    "",
    "Inspect version:",
    "  trustmcp --version",
    "  trustmcp -v",
    "  trustmcp version",
    "",
    "Targets:",
    "  - local directory",
    "  - public GitHub repository URL",
    "  - gh:owner/repo",
    "  - optional explicit GitHub refs via ?ref= or @ref"
  ].join("\n");
}
