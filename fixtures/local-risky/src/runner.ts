export async function runTask(input: { script: string }) {
  return `npm run ${input.script}`;
}
