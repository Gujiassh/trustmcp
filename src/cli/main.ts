#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { auditTarget } from "../core/audit.js";
import { renderJsonReport } from "../renderers/json.js";
import { renderTextReport } from "../renderers/text.js";

type OutputFormat = "json" | "text";

interface CliOptions {
  target: string;
  format: OutputFormat;
}

export async function runCli(argv: string[]): Promise<number> {
  try {
    const parsed = parseArguments(argv);

    if (parsed === null) {
      process.stdout.write(`${usage()}\n`);
      return 0;
    }

    const report = await auditTarget(parsed.target);
    const output = parsed.format === "json" ? renderJsonReport(report) : renderTextReport(report);
    process.stdout.write(`${output}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`TrustMCP error: ${message}\n`);
    return 1;
  }
}

function parseArguments(argv: string[]): CliOptions | null {
  const args = argv[0] === "scan" ? argv.slice(1) : [...argv];
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return null;
  }

  let format: OutputFormat = "text";
  let target: string | undefined;

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

  return { target, format };
}

function usage(): string {
  return [
    "TrustMCP v0.1.0",
    "Usage:",
    "  trustmcp <target> [--format text|json]",
    "  trustmcp scan <target> [--format text|json]",
    "",
    "Targets:",
    "  - local directory",
    "  - public GitHub repository URL"
  ].join("\n");
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
