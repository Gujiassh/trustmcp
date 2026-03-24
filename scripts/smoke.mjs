import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { auditTarget } from "../dist/core/audit.js";
import { renderJsonReport } from "../dist/renderers/json.js";
import { renderTextReport } from "../dist/renderers/text.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const fixturePath = resolve(repoRoot, "fixtures/local-risky");

const report = await auditTarget(fixturePath);

if (report.findings.length === 0) {
  throw new Error("Smoke fixture did not trigger any findings.");
}

process.stdout.write("=== TrustMCP smoke: text ===\n");
process.stdout.write(`${renderTextReport(report)}\n`);
process.stdout.write("\n=== TrustMCP smoke: json ===\n");
process.stdout.write(`${renderJsonReport(report)}\n`);
