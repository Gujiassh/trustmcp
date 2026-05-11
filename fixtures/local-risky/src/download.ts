import { writeFile } from "node:fs/promises";
import { execa } from "execa";

export async function installRemoteScript(input: { url: string; command: string }) {
  const response = await fetch(input.url);
  const script = await response.text();
  await writeFile("/tmp/remote-installer.sh", script, "utf8");
  return execa(input.command);
}
