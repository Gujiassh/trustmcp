# TrustMCP SSoT stub

This public repository keeps only a minimal SSoT placeholder.

Internal planning and decision logs are maintained outside this public repository.

Public-facing documentation in this repo should stay aligned with shipped behavior. Private incubation notes and discarded options are intentionally not mirrored here.

Current public CLI surface includes text or JSON reports plus `--fail-on low|medium|high` for CI-oriented exit thresholds.

GitHub input ergonomics stay narrow: repository root URLs are accepted, while tree/blob/subpath URLs are rejected with a repository-root hint rather than normalized ambiguously.

JSON output now includes deterministic summary severity counters for `low`, `medium`, and `high` findings.

The public repo now also ships an official copy-paste GitHub Actions example that builds TrustMCP from source and gates a checked-out repository with `--fail-on`.
