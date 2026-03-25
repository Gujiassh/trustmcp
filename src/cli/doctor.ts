import { looksLikeUrl } from "../core/rule-helpers.js";
import { getUnsupportedGitHubUrlMessage, parseGitHubRepositoryUrl } from "../inputs/github.js";
import { materializeLocalDirectory } from "../inputs/local.js";
import { loadCliConfig } from "./config.js";
import { validateNodeRuntimeVersion } from "./node-runtime.js";
import { validateCliOptionCompatibility } from "./validate-cli-options.js";
import { validateOutputFilePath } from "../utils/write-rendered-output.js";

export type DoctorFormat = "json" | "text";

export interface DoctorOptions {
  target: string;
  configFile?: string;
}

export interface DoctorCheckResult {
  ok: boolean;
  message: string;
}

export interface DoctorResult {
  ok: boolean;
  config: DoctorCheckResult;
  runtime: DoctorCheckResult;
  statusMessage: string;
  target: DoctorCheckResult;
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const configCheck = await validateConfigFile(options.configFile);
  const runtimeCheck = await validateRuntime();
  const targetCheck = await validateTarget(options.target);
  const ok = configCheck.ok && runtimeCheck.ok && targetCheck.ok;

  return {
    ok,
    config: configCheck,
    runtime: runtimeCheck,
    statusMessage: ok ? "ready to scan." : "fix the errors above and run doctor again.",
    target: targetCheck
  };
}

export function renderDoctorResult(result: DoctorResult, format: DoctorFormat): string {
  if (format === "json") {
    return JSON.stringify(
      {
        ok: result.ok,
        config: result.config,
        runtime: result.runtime,
        target: result.target,
        status: result.statusMessage
      },
      null,
      2
    );
  }

  return [
    "TrustMCP doctor",
    result.config.ok ? `Config: OK ${result.config.message}` : `Config: ERROR ${result.config.message}`,
    result.runtime.ok ? `Runtime: OK ${result.runtime.message}` : `Runtime: ERROR ${result.runtime.message}`,
    result.target.ok ? `Target: OK ${result.target.message}` : `Target: ERROR ${result.target.message}`,
    `Status: ${result.statusMessage}`
  ].join("\n");
}

async function validateRuntime(): Promise<DoctorCheckResult> {
  try {
    return await validateNodeRuntimeVersion();
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

async function validateConfigFile(configFile?: string): Promise<DoctorCheckResult> {
  if (configFile === undefined) {
    return {
      ok: true,
      message: "not provided"
    };
  }

  try {
    const config = await loadCliConfig(configFile);
    validateCliOptionCompatibility(config, "Config");

    if (config.outputFile !== undefined) {
      await validateOutputFilePath(config.outputFile);
    }

    return {
      ok: true,
      message: config.outputFile === undefined ? configFile : `${configFile} (output-file OK: ${config.outputFile})`
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

async function validateTarget(target: string): Promise<DoctorCheckResult> {
  const gitHubReference = parseGitHubRepositoryUrl(target);
  if (gitHubReference !== null) {
    return {
      ok: true,
      message: `GitHub repository input (${gitHubReference.displayName})`
    };
  }

  const unsupportedGitHubUrlMessage = getUnsupportedGitHubUrlMessage(target);
  if (unsupportedGitHubUrlMessage !== null) {
    return {
      ok: false,
      message: unsupportedGitHubUrlMessage
    };
  }

  if (looksLikeUrl(target)) {
    return {
      ok: false,
      message: "Unsupported URL. TrustMCP doctor accepts local directories, GitHub repository root URLs, or gh:owner/repo."
    };
  }

  try {
    const source = await materializeLocalDirectory(target);
    return {
      ok: true,
      message: `local directory (${source.target.displayName})`
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
