export function startListener(input: { port: number }) {
  return app.listen(input.port, "0.0.0.0");
}
