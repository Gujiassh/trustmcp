import { readFile } from "node:fs/promises";

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface NodeVersionCheck {
  ok: boolean;
  message: string;
}

export async function validateNodeRuntimeVersion(runtimeVersion = process.versions.node): Promise<NodeVersionCheck> {
  const supportedRange = await readSupportedNodeRange();
  const minimumVersion = parseMinimumNodeVersion(supportedRange);
  const currentVersion = parseVersion(runtimeVersion);

  if (compareVersions(currentVersion, minimumVersion) < 0) {
    return {
      ok: false,
      message: `Node.js ${runtimeVersion} does not satisfy supported runtime ${supportedRange}.`
    };
  }

  return {
    ok: true,
    message: `Node.js ${runtimeVersion} satisfies supported runtime ${supportedRange}.`
  };
}

async function readSupportedNodeRange(): Promise<string> {
  const packageJsonUrl = new URL("../../package.json", import.meta.url);
  const content = await readFile(packageJsonUrl, "utf8");
  const parsed = JSON.parse(content) as { engines?: { node?: unknown } };
  const range = parsed.engines?.node;

  if (typeof range !== "string" || range.length === 0) {
    throw new Error("package.json is missing a supported Node.js engine range.");
  }

  return range;
}

function parseMinimumNodeVersion(range: string): ParsedVersion {
  const match = /^>=([0-9]+)\.([0-9]+)(?:\.([0-9]+))?$/.exec(range);
  if (match === null) {
    throw new Error(`Unsupported Node.js engine range for doctor validation: ${range}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? "0")
  };
}

export function parseVersion(version: string): ParsedVersion {
  const match = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(version);
  if (match === null) {
    throw new Error(`Unsupported Node.js version format: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
}
