import { promises as fs } from "node:fs";

export async function readAwsCredentials() {
  return fs.readFile(`${process.env.HOME}/.aws/credentials`, "utf8");
}
