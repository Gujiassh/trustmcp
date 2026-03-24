import { describe, expect, it } from "vitest";

import { auditTarget } from "../src/core/audit.js";
import { getUnsupportedGitHubUrlMessage, parseGitHubRepositoryUrl } from "../src/inputs/github.js";

describe("parseGitHubRepositoryUrl", () => {
  it("parses a public GitHub repository URL", () => {
    const parsed = parseGitHubRepositoryUrl("https://github.com/modelcontextprotocol/servers");

    expect(parsed).not.toBeNull();
    expect(parsed?.owner).toBe("modelcontextprotocol");
    expect(parsed?.repo).toBe("servers");
    expect(parsed?.displayName).toBe("modelcontextprotocol/servers");
  });

  it("parses supported repository root variants", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/modelcontextprotocol/servers/")?.canonicalUrl)
      .toBe("https://github.com/modelcontextprotocol/servers");
    expect(parseGitHubRepositoryUrl("https://github.com/modelcontextprotocol/servers.git")?.canonicalUrl)
      .toBe("https://github.com/modelcontextprotocol/servers");
    expect(parseGitHubRepositoryUrl("https://github.com/modelcontextprotocol/servers?tab=readme-ov-file")?.canonicalUrl)
      .toBe("https://github.com/modelcontextprotocol/servers");
  });

  it("rejects non-GitHub URLs", () => {
    expect(parseGitHubRepositoryUrl("https://example.com/repo")).toBeNull();
    expect(parseGitHubRepositoryUrl("not-a-url")).toBeNull();
  });

  it("rejects GitHub URLs with extra path segments", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/modelcontextprotocol/servers/tree/main")).toBeNull();
    expect(parseGitHubRepositoryUrl("https://github.com/modelcontextprotocol/servers/issues/1")).toBeNull();
  });
});

describe("getUnsupportedGitHubUrlMessage", () => {
  it("explains rejected tree URLs with a root-url hint", () => {
    const message = getUnsupportedGitHubUrlMessage("https://github.com/modelcontextprotocol/servers/tree/main");

    expect(message).toContain("GitHub tree URLs are not supported.");
    expect(message).toContain("Use the repository root URL instead: https://github.com/modelcontextprotocol/servers");
  });

  it("explains rejected blob and subpath URLs with a root-url hint", () => {
    const blobMessage = getUnsupportedGitHubUrlMessage(
      "https://github.com/modelcontextprotocol/servers/blob/main/README.md"
    );
    const subpathMessage = getUnsupportedGitHubUrlMessage(
      "https://github.com/modelcontextprotocol/servers/issues/1"
    );

    expect(blobMessage).toContain("GitHub blob URLs are not supported.");
    expect(blobMessage).toContain("default-branch head SHA");
    expect(subpathMessage).toContain("GitHub subpath URLs are not supported.");
  });
});

describe("auditTarget GitHub URL ergonomics", () => {
  it("fails early with a specific message for unsupported GitHub URL shapes", async () => {
    await expect(auditTarget("https://github.com/modelcontextprotocol/servers/blob/main/README.md"))
      .rejects.toThrowError(
        "GitHub blob URLs are not supported. TrustMCP scans GitHub repository roots only and resolves the current default-branch head SHA. Use the repository root URL instead: https://github.com/modelcontextprotocol/servers"
      );
  });
});
