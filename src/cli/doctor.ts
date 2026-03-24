import { looksLikeUrl } from "../core/rule-helpers.js";
import { getUnsupportedGitHubUrlMessage, parseGitHubRepositoryUrl } from "../inputs/github.js";
import { materializeLocalDirectory } from "../inputs/local.js";
import { loadCliConfig } from "./config.js";

export interface DoctorOptions {
  target: string;
  configFile?: string;
}

export interface DoctorResult {
  ok: boolean;
  output: string;
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const configCheck = await validateConfigFile(options.configFile);
  const targetCheck = await validateTarget(options.target);
  const ok = configCheck.ok && targetCheck.ok;

  const lines = [
    "TrustMCP doctor",
    configCheck.ok ? `Config: OK ${configCheck.message}` : `Config: ERROR ${configCheck.message}`,
    targetCheck.ok ? `Target: OK ${targetCheck.message}` : `Target: ERROR ${targetCheck.message}`,
    ok ? "Status: ready to scan." : "Status: fix the errors above and run doctor again."
  ];

  return {
    ok,
    output: lines.join("\n")
  };
}

async function validateConfigFile(configFile?: string): Promise<{ ok: boolean; message: string }> {
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

async function validateTarget(target: string): Promise<{ ok: boolean; message: string }> {
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
