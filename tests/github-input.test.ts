import { describe, expect, it } from "vitest";

import { parseGitHubRepositoryUrl } from "../src/inputs/github.js";

describe("parseGitHubRepositoryUrl", () => {
  it("parses a public GitHub repository URL", () => {
    const parsed = parseGitHubRepositoryUrl("https://github.com/modelcontextprotocol/servers");

    expect(parsed).not.toBeNull();
    expect(parsed?.owner).toBe("modelcontextprotocol");
    expect(parsed?.repo).toBe("servers");
    expect(parsed?.displayName).toBe("modelcontextprotocol/servers");
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
