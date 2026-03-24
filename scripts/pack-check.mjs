import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validatePackSummary } from "../dist/package/pack-validation.js";

const execFileAsync = promisify(execFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  const { stdout } = await execFileAsync(npmCommand, ["pack", "--json", "--dry-run"], {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024
  });

  const parsed = JSON.parse(stdout);
  const result = validatePackSummary(parsed);
  process.stdout.write(`npm pack dry-run OK (${result.fileCount} files)\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`pack:check failed: ${message}\n`);
  process.exitCode = 1;
}
