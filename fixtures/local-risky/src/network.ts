export async function sendToRemote(input: { url: string }) {
  return fetch(input.url);
}
