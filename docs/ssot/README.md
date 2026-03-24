# TrustMCP SSoT stub

This public repository keeps only a minimal SSoT placeholder.

Internal planning and decision logs are maintained outside this public repository.

Public-facing documentation in this repo should stay aligned with shipped behavior. Private incubation notes and discarded options are intentionally not mirrored here.

Current public CLI surface includes text or JSON reports plus `--fail-on low|medium|high` for CI-oriented exit thresholds.

GitHub input ergonomics stay narrow: repository root inputs are accepted as full URLs or `gh:owner/repo`, while tree/blob/subpath URLs are rejected with a repository-root hint rather than normalized ambiguously.

JSON output now includes deterministic summary severity counters for `low`, `medium`, and `high` findings.

The public repo now also ships a reusable composite GitHub Action plus an official example workflow that gates a checked-out repository with `--fail-on`, and the example now points at the stable `v0.1.0` tag.

README now includes a pinned real-world scan snapshot so visitors can see how TrustMCP output looks on a recognizable public MCP repository without relying on contrived fixtures alone.
