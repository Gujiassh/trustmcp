import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

describe("package scripts", () => {
  it("defines a release:check script that composes reference and publish checks", async () => {
    const parsed = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(parsed.scripts?.["reference:check"]).toBe("npm run build && node scripts/reference-target-check.mjs");
    expect(parsed.scripts?.["reference:scan"]).toBe("npm run build && node scripts/reference-target-check.mjs --scan");
    expect(parsed.scripts?.["publish:check"]).toBe("npm test && npm run build && npm run pack:check && npm run pack:smoke");
    expect(parsed.scripts?.["release:check"]).toBe("npm run reference:check && npm run publish:check");
  });
});
