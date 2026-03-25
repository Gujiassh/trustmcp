import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

let temporaryRoot;

try {
  temporaryRoot = await mkdtemp(join(tmpdir(), "trustmcp-pack-smoke-"));
  const tarballDirectory = join(temporaryRoot, "tarball");
  const installDirectory = join(temporaryRoot, "install");

  await mkdir(tarballDirectory, { recursive: true });
  await mkdir(installDirectory, { recursive: true });

  const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
  const expectedVersion = packageJson.version;

  const { stdout: packStdout } = await execFileAsync(
    npmCommand,
    ["pack", "--json", "--pack-destination", tarballDirectory],
    {
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024
    }
  );

  const parsedPackOutput = JSON.parse(packStdout);
  if (!Array.isArray(parsedPackOutput) || parsedPackOutput.length === 0) {
    throw new Error("npm pack did not return a tarball entry.");
  }

  const tarballName = parsedPackOutput[0]?.filename;
  if (typeof tarballName !== "string" || tarballName.length === 0) {
    throw new Error("npm pack did not report a tarball filename.");
  }

  await writeFile(
    join(installDirectory, "package.json"),
    JSON.stringify({ name: "trustmcp-pack-smoke", private: true }, null, 2) + "\n",
    "utf8"
  );

  await execFileAsync(
    npmCommand,
    ["install", "--no-fund", "--no-audit", join(tarballDirectory, tarballName)],
    {
      cwd: installDirectory,
      maxBuffer: 10 * 1024 * 1024
    }
  );

  const cliEntrypoint = join(installDirectory, "node_modules", "trustmcp", "dist", "cli", "main.js");
  const { stdout: versionStdout } = await execFileAsync(process.execPath, [cliEntrypoint, "--version"], {
    cwd: installDirectory,
    maxBuffer: 10 * 1024 * 1024
  });

  if (versionStdout.trim() !== expectedVersion) {
    throw new Error(`Installed tarball reported version '${versionStdout.trim()}', expected '${expectedVersion}'.`);
  }

  process.stdout.write(`pack:smoke OK (${tarballName}, trustmcp@${expectedVersion})\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`pack:smoke failed: ${message}\n`);
  process.exitCode = 1;
} finally {
  if (temporaryRoot !== undefined) {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
