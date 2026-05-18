#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { auditTarget as defaultAuditTarget } from "../core/audit.js";
import { shouldFailForThreshold } from "../core/thresholds.js";
import { TRUSTMCP_VERSION } from "../core/version.js";
import { loadBaselineEntries, loadCliConfig } from "./config.js";
import { renderDoctorResult, runDoctor } from "./doctor.js";
import { writeStarterConfig } from "./init-config.js";
import { renderRuleList, renderRuleListJson } from "./list-rules.js";
import { validateCliOptionCompatibility } from "./validate-cli-options.js";
import { renderReport, renderSummaryReport } from "../renderers/output.js";
import { writeRenderedOutput } from "../utils/write-rendered-output.js";
import { findingsToBaselineEntries } from "../core/baseline-entries.js";
import { writeBaselineFile } from "../utils/baseline-output.js";
import {
  isDoctorCommand,
  isInitConfigCommand,
  isListRulesCommand,
  isVersionCommand,
  parseArguments,
  resolveCliOptions,
  usage
} from "./arguments.js";

export { parseArguments, resolveCliOptions } from "./arguments.js";

interface OutputWriter {
  write(chunk: string): unknown;
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
      const output = renderDoctorResult(result, parsed.format);
      await writeRenderedOutput(output, parsed.outputFile);
      stdout.write(`${output}\n`);
      return result.ok ? 0 : 1;
    }

    if (isListRulesCommand(parsed)) {
      const output = parsed.format === "json" ? renderRuleListJson() : renderRuleList();
      await writeRenderedOutput(output, parsed.outputFile);
      stdout.write(`${output}\n`);
      return 0;
    }

    if (isVersionCommand(parsed)) {
      stdout.write(`${TRUSTMCP_VERSION}\n`);
      return 0;
    }

    const config = await loadCliConfig(parsed.configFile);
    const resolved = resolveCliOptions(parsed, config);
    validateCliOptionCompatibility(resolved);

    const configPath =
      parsed.configFile === undefined ? undefined : resolve(process.cwd(), parsed.configFile);
    const baselineBaseDir = configPath === undefined ? process.cwd() : dirname(configPath);
    const baselineEntries = await loadBaselineEntries(resolved.baselineFile, baselineBaseDir);
    const auditOptions = {
      ...(resolved.ignoreRules === undefined ? {} : { ignoreRules: resolved.ignoreRules }),
      ...(resolved.ignorePaths === undefined ? {} : { ignorePaths: resolved.ignorePaths }),
      ...(baselineEntries === undefined ? {} : { baselineEntries })
    };

    const report = await auditTarget(resolved.target, auditOptions);
    const output = resolved.summaryOnly ? renderSummaryReport(report, resolved.format) : renderReport(report, resolved.format);
    const baselineOutputPath =
      resolved.baselineOutput === undefined
        ? undefined
        : resolveConfigRelativePath(resolved.baselineOutput, configPath === undefined ? process.cwd() : dirname(configPath));

    await writeRenderedOutput(output, resolved.outputFile);
    if (baselineOutputPath !== undefined) {
      await writeBaselineFile(baselineOutputPath, findingsToBaselineEntries(report.findings));
    }

    stdout.write(`${output}\n`);
    return shouldFailForThreshold(report, resolved.failOn) ? 2 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`TrustMCP error: ${message}\n`);
    return 1;
  }
}

function resolveConfigRelativePath(filePath: string, baseDirectory: string): string {
  return filePath.startsWith("/") ? filePath : resolve(baseDirectory, filePath);
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
