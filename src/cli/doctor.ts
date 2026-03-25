import { looksLikeUrl } from "../core/rule-helpers.js";
import { getUnsupportedGitHubUrlMessage, parseGitHubRepositoryUrl } from "../inputs/github.js";
import { materializeLocalDirectory } from "../inputs/local.js";
import { loadCliConfig } from "./config.js";

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
  statusMessage: string;
  target: DoctorCheckResult;
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const configCheck = await validateConfigFile(options.configFile);
  const targetCheck = await validateTarget(options.target);
  const ok = configCheck.ok && targetCheck.ok;

  return {
    ok,
    config: configCheck,
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
    result.target.ok ? `Target: OK ${result.target.message}` : `Target: ERROR ${result.target.message}`,
    `Status: ${result.statusMessage}`
  ].join("\n");
}

async function validateConfigFile(configFile?: string): Promise<DoctorCheckResult> {
  if (configFile === undefined) {
    return {
      ok: true,
      message: "not provided"
    };
  }

  try {
    await loadCliConfig(configFile);
    return {
      ok: true,
      message: configFile
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
