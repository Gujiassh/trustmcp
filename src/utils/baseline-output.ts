import { writeFile } from "node:fs/promises";
import type { BaselineEntry } from "../core/types.js";
import { validateOutputFilePath } from "./write-rendered-output.js";

export async function writeBaselineFile(baselineOutput: string, entries: BaselineEntry[]): Promise<void> {
  if (baselineOutput.length === 0) {
    return;
  }

  await validateOutputFilePath(baselineOutput);
  await writeFile(baselineOutput, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}
