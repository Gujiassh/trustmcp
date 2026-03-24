import { describe, expect, it } from "vitest";

import { isAllowedPackFilePath, validatePackSummary } from "../src/package/pack-validation.js";

describe("pack validation", () => {
  it("allows the intended npm pack file set", () => {
    expect(isAllowedPackFilePath("LICENSE")).toBe(true);
    expect(isAllowedPackFilePath("README.md")).toBe(true);
    expect(isAllowedPackFilePath("package.json")).toBe(true);
    expect(isAllowedPackFilePath("dist/cli/main.js")).toBe(true);
    expect(isAllowedPackFilePath("dist/index.d.ts")).toBe(true);
  });

  it("rejects sourcemaps and unrelated files from the pack list", () => {
    expect(isAllowedPackFilePath("dist/cli/main.js.map")).toBe(false);
    expect(isAllowedPackFilePath("dist/cli/main.d.ts.map")).toBe(false);
    expect(isAllowedPackFilePath("docs/troubleshooting.md")).toBe(false);
    expect(isAllowedPackFilePath("tests/cli.test.ts")).toBe(false);
  });

  it("validates a sensible npm pack summary", () => {
    expect(validatePackSummary([
      {
        files: [
          { path: "LICENSE" },
          { path: "README.md" },
          { path: "package.json" },
          { path: "dist/cli/main.js" },
          { path: "dist/index.js" },
          { path: "dist/index.d.ts" },
          { path: "dist/renderers/output.js" }
        ]
      }
    ])).toEqual({
      fileCount: 7,
      includedPaths: [
        "LICENSE",
        "README.md",
        "package.json",
        "dist/cli/main.js",
        "dist/index.js",
        "dist/index.d.ts",
        "dist/renderers/output.js"
      ]
    });
  });

  it("fails when npm pack includes unexpected files", () => {
    expect(() => validatePackSummary([
      {
        files: [
          { path: "LICENSE" },
          { path: "README.md" },
          { path: "package.json" },
          { path: "dist/cli/main.js" },
          { path: "dist/index.js" },
          { path: "dist/index.d.ts" },
          { path: "dist/cli/main.js.map" }
        ]
      }
    ])).toThrowError("Unexpected files in npm pack output: dist/cli/main.js.map");
  });
});
