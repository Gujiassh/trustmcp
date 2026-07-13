# Changelog

This changelog is the lightweight public release history for TrustMCP.

- Add the newest release near the top.
- Keep entries short and human-readable.
- Link deeper implementation detail from the repository when useful, but keep this file focused on shipped behavior.

## v0.2.0 — release candidate (2026-07-13)

- Expand the shipped rule set beyond the original shell/network/filesystem baseline with dynamic code execution, script-runner wrappers, environment secret exposure, archive extraction, download-write-exec chains, local listener binding, sensitive local data access, subprocess-network exfiltration, and risky tool metadata coverage.
- Add richer risky fixture coverage, including destructive filesystem mutation paths, and keep the accepted risky baseline corpus aligned with the current finding inventory.
- Harden baseline semantics with fingerprint-first identity, legacy tuple compatibility, explicit baseline-output generation, and baseline gating behavior that stays active even for an empty checked-in baseline file.
- Improve GitHub Action parity with the CLI by fixing workspace-relative local targets, aligning config-file relative path behavior, and exposing baseline-aware machine-readable outputs consistently.
- Extend SARIF so result entries carry stable TrustMCP finding identity plus baseline/new/gated policy-state metadata, and rule entries now expose machine-readable confidence guidance metadata.
- Add the optional `confidenceReason` finding field plus rule-level `confidenceLevels`, `confidenceReasons`, and `confidenceGuidance` metadata for machine consumers.
- Add or refresh operator-facing docs and examples for project-level policy adoption, release confidence checks, contributor regression guardrails, sticky PR comments, and the current thirteen-rule scanner surface.
- Make live reference-target scans report target-level failures while preserving results for targets that completed, so release-confidence checks stay diagnosable when one public GitHub archive fetch fails.
- Replace raw call-text matching in high-risk rules with parser-backed executable syntax analysis, add `fs/promises` import parity, require connected function-scoped data flow for chain findings, and add shallow environment-secret source-to-sink tracking.
- Add deterministic scan coverage metadata for oversized, binary, and symbolic-link source files across JSON, text, Markdown, summary-only, SARIF, and GitHub Action outputs.
- Bound public GitHub archive extraction by entry count, per-entry uncompressed size, total uncompressed size, and canonical destination validation before writing files.
- Add focused source collector, adversarial rule, and GitHub archive regression suites. The final GitHub release and npm publication remain manual maintainer steps.

## v0.1.0 — npm published

- Published `trustmcp@0.1.0` to npm.

## v0.1.0 — 2026-03-24

Initial public release.

- Shipped the TypeScript CLI and reusable GitHub Action for static TrustMCP scanning.
- Added the first three capability-focused rules: `mcp/shell-exec`, `mcp/outbound-fetch`, and `mcp/broad-filesystem`.
- Shipped text, JSON, Markdown, and SARIF output paths, plus CI-oriented `--fail-on` support.
- Added first-pass public docs, troubleshooting, rule explainers, action examples, and conservative release/package-readiness paths.
