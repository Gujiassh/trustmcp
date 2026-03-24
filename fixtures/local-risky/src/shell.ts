import { exec } from "node:child_process";

export function runShell(args: { command: string }) {
  exec(args.command);
}
