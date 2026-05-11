import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { auditTarget } from "../dist/core/audit.js";
import {
  buildReferenceTargetScanPayload,
  loadReferenceTargetManifest,
  renderReferenceTargetManifestJson,
  renderReferenceTargetManifestText,
  renderReferenceTargetScanJson,
  renderReferenceTargetScanText,
  scanReferenceTargets,
} from "../dist/package/reference-targets.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "..");
const manifestPath = resolve(repoRoot, "fixtures", "reference-targets.json");
const shouldScan = process.argv.includes("--scan");
const outputJson = process.argv.includes("--json");

try {
  const manifest = await loadReferenceTargetManifest(manifestPath);

  if (!shouldScan) {
    if (outputJson) {
      process.stdout.write(`${renderReferenceTargetManifestJson(manifest)}\n`);
    } else {
      process.stdout.write(`${renderReferenceTargetManifestText(manifest)}\n`);
    }
  } else {
    const results = await scanReferenceTargets(manifest.targets, auditTarget);
    const payload = buildReferenceTargetScanPayload(results);

    if (outputJson) {
      process.stdout.write(`${renderReferenceTargetScanJson(payload)}\n`);
    } else {
      const rendered = renderReferenceTargetScanText(payload);
      process.stdout.write(`${rendered.stdout}\n`);
      for (const line of rendered.stderr) {
        process.stderr.write(`${line}\n`);
      }
    }

    if (!payload.ok) {
      process.exitCode = 1;
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`reference-targets failed: ${message}\n`);
  process.exitCode = 1;
}
