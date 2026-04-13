# Changelog

This changelog is the lightweight public release history for TrustMCP.

- Add the newest release near the top.
- Keep entries short and human-readable.
- Link deeper implementation detail from the repository when useful, but keep this file focused on shipped behavior.

## Unreleased

- Document new `ignore-rules` and `ignore-paths` config fields and clarify their intent.

- Add upcoming release notes here before the next GitHub release.

## v0.1.0 — npm published

- Published `trustmcp@0.1.0` to npm.

## v0.1.0 — 2026-03-24

Initial public release.

- Shipped the TypeScript CLI and reusable GitHub Action for static TrustMCP scanning.
- Added the first three capability-focused rules: `mcp/shell-exec`, `mcp/outbound-fetch`, and `mcp/broad-filesystem`.
- Shipped text, JSON, Markdown, and SARIF output paths, plus CI-oriented `--fail-on` support.
- Added first-pass public docs, troubleshooting, rule explainers, action examples, and conservative release/package-readiness paths.
