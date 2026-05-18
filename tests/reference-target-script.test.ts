import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

describe("reference-target-check script", () => {
  beforeAll(async () => {
    await execFileAsync(npmCommand, ["run", "build"], {
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024
    });
  });

  it("emits stable JSON for manifest mode", async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["scripts/reference-target-check.mjs", "--json"],
      { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 }
    );

    const parsed = JSON.parse(stdout) as {
      targets: Array<{ id: string; expectedCategory: string; target: string }>;
    };

    expect(parsed.targets).toHaveLength(3);
    expect(parsed.targets[0]).toMatchObject({
      id: "finding-producing",
      expectedCategory: "finding-producing"
    });
  });
});
