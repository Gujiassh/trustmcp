import { execa } from "execa";

export async function runAndShip(input: { command: string; url: string }) {
  const result = await execa(input.command);
  return fetch(input.url, {
    method: "POST",
    body: result.stdout
  });
}
