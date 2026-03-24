import { mkdtemp, readdir, rm } from "node:fs/promises";
import https from "node:https";
import { join } from "node:path";
import { tmpdir } from "node:os";

import AdmZip from "adm-zip";

import { TRUSTMCP_VERSION } from "../core/version.js";
import type { MaterializedSource } from "../core/types.js";

interface GitHubRepositoryReference {
  owner: string;
  repo: string;
  canonicalUrl: string;
  displayName: string;
}

interface HttpResult {
  statusCode: number;
  body: Buffer;
}

interface GitHubRepositoryMetadata {
  defaultBranch: string;
  headSha: string;
}

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 25_000_000;

export function parseGitHubRepositoryUrl(input: string): GitHubRepositoryReference | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.hostname !== "github.com") {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) {
      return null;
    }

    const owner = parts[0];
    const repoPart = parts[1];

    if (owner === undefined || repoPart === undefined) {
      return null;
    }

    const repo = repoPart.replace(/\.git$/, "");

    if (owner.length === 0 || repo.length === 0) {
      return null;
    }

    return {
      owner,
      repo,
      canonicalUrl: `https://github.com/${owner}/${repo}`,
      displayName: `${owner}/${repo}`
    };
  } catch {
    return null;
  }
}

export async function materializeGitHubRepository(input: string): Promise<MaterializedSource> {
  const reference = parseGitHubRepositoryUrl(input);
  if (reference === null) {
    throw new Error("Unsupported URL. TrustMCP accepts local directories or public GitHub repository URLs.");
  }

  const metadata = await fetchRepositoryMetadata(reference);
  const archiveBuffer = await downloadRepositoryArchive(reference, metadata.headSha);
  const tempRoot = await mkdtemp(join(tmpdir(), "trustmcp-"));

  try {
    const archive = new AdmZip(archiveBuffer);
    archive.extractAllTo(tempRoot, true);

    const extractedRoot = await resolveExtractedRoot(tempRoot);

    return {
      rootDir: extractedRoot,
      target: {
        input,
        displayName: reference.displayName,
        sourceType: "public-github-repo",
        resolvedRef: `${metadata.defaultBranch}@${metadata.headSha}`
      },
      cleanup: async () => {
        await rm(tempRoot, { recursive: true, force: true });
      }
    };
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

async function fetchRepositoryMetadata(
  reference: GitHubRepositoryReference
): Promise<GitHubRepositoryMetadata> {
  const apiUrl = `https://api.github.com/repos/${reference.owner}/${reference.repo}`;
  const response = await requestUrl(apiUrl, "application/vnd.github+json");

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(buildHttpError(apiUrl, response));
  }

  const payload = JSON.parse(response.body.toString("utf8"));
  if (!isGitHubMetadataPayload(payload)) {
    throw new Error(`GitHub API response for ${reference.displayName} did not include a default branch.`);
  }

  const branchUrl = `https://api.github.com/repos/${reference.owner}/${reference.repo}/branches/${encodeURIComponent(payload.default_branch)}`;
  const branchResponse = await requestUrl(branchUrl, "application/vnd.github+json");

  if (branchResponse.statusCode < 200 || branchResponse.statusCode >= 300) {
    throw new Error(buildHttpError(branchUrl, branchResponse));
  }

  const branchPayload = JSON.parse(branchResponse.body.toString("utf8"));
  if (!isGitHubBranchPayload(branchPayload)) {
    throw new Error(`GitHub branch response for ${reference.displayName} did not include a commit SHA.`);
  }

  return {
    defaultBranch: payload.default_branch,
    headSha: branchPayload.commit.sha
  };
}

async function downloadRepositoryArchive(
  reference: GitHubRepositoryReference,
  headSha: string
): Promise<Buffer> {
  const archiveUrl = `https://github.com/${reference.owner}/${reference.repo}/archive/${headSha}.zip`;
  const response = await requestUrl(archiveUrl, "application/zip");

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(buildHttpError(archiveUrl, response));
  }

  return response.body;
}

async function resolveExtractedRoot(tempRoot: string): Promise<string> {
  const entries = await readdir(tempRoot, { withFileTypes: true });
  const extractedDirectory = entries.find((entry) => entry.isDirectory());

  if (extractedDirectory === undefined) {
    throw new Error("GitHub archive did not extract into a directory.");
  }

  return join(tempRoot, extractedDirectory.name);
}

async function requestUrl(url: string, accept: string, redirectCount = 0): Promise<HttpResult> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects while fetching ${url}`);
  }

  return new Promise<HttpResult>((resolve, reject) => {
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    };

    const request = https.request(
      new URL(url),
      {
        method: "GET",
        headers: {
          Accept: accept,
          "User-Agent": `TrustMCP/${TRUSTMCP_VERSION}`
        }
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if ([301, 302, 303, 307, 308].includes(statusCode) && location !== undefined) {
          response.resume();
          const redirectUrl = new URL(location, url).toString();
          void requestUrl(redirectUrl, accept, redirectCount + 1).then(
            (result) => {
              if (settled) {
                return;
              }

              settled = true;
              resolve(result);
            },
            (error) => {
              fail(error instanceof Error ? error : new Error(String(error)));
            }
          );
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        response.on("data", (chunk: Buffer | string) => {
          if (settled) {
            return;
          }

          const normalizedChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += normalizedChunk.length;

          if (totalBytes > MAX_RESPONSE_BYTES) {
            response.destroy();
            fail(new Error(`Response exceeded ${MAX_RESPONSE_BYTES} bytes while fetching ${url}`));
            return;
          }

          chunks.push(normalizedChunk);
        });
        response.on("error", (error) => {
          fail(error instanceof Error ? error : new Error(String(error)));
        });
        response.on("end", () => {
          if (settled) {
            return;
          }

          settled = true;
          resolve({
            statusCode,
            body: Buffer.concat(chunks)
          });
        });
      }
    );

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms for ${url}`));
    });
    request.on("error", (error) => {
      fail(error instanceof Error ? error : new Error(String(error)));
    });
    request.end();
  });
}

function buildHttpError(url: string, response: HttpResult): string {
  const responseBody = response.body.toString("utf8").trim();
  const suffix = responseBody.length > 0 ? ` ${responseBody}` : "";
  return `Request failed for ${url}: HTTP ${response.statusCode}.${suffix}`;
}

function isGitHubMetadataPayload(value: unknown): value is { default_branch: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { default_branch?: unknown };
  return typeof candidate.default_branch === "string" && candidate.default_branch.length > 0;
}

function isGitHubBranchPayload(value: unknown): value is { commit: { sha: string } } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { commit?: { sha?: unknown } };
  return typeof candidate.commit?.sha === "string" && candidate.commit.sha.length > 0;
}
