import type { OutputFormat } from "../renderers/output.js";

interface CliOptionCompatibilityInput {
  format?: OutputFormat;
  summaryOnly?: boolean;
}

export function validateCliOptionCompatibility(
  options: CliOptionCompatibilityInput,
  context = "Options"
): void {
  if (options.summaryOnly === true && options.format === "sarif") {
    throw new Error(`Invalid option combination in ${context.toLowerCase()}: --summary-only is not supported with --format sarif.`);
  }
}
