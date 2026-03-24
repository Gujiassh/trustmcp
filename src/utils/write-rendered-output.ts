import { stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeRenderedOutput(output: string, outputFile?: string): Promise<void> {
  if (outputFile === undefined || outputFile.length === 0) {
    return;
  }

  const outputDirectory = dirname(outputFile);
  let outputDirectoryStats: Awaited<ReturnType<typeof stat>>;

  try {
    outputDirectoryStats = await stat(outputDirectory);
  } catch {
    throw new Error(`Output file directory does not exist: ${outputDirectory}`);
  }

  if (!outputDirectoryStats.isDirectory()) {
    throw new Error(`Output file directory is not a directory: ${outputDirectory}`);
  }

  await writeFile(outputFile, `${output}\n`, "utf8");
}
