# TrustMCP SSoT stub

This public repository keeps only a minimal SSoT placeholder.

Internal planning and decision logs are maintained outside this public repository.

Public-facing documentation in this repo should stay aligned with shipped behavior. Private incubation notes and discarded options are intentionally not mirrored here.

Current public CLI surface includes text or JSON reports plus `--fail-on low|medium|high` for CI-oriented exit thresholds.

Public output formats now include `text`, `json`, `markdown`, and deterministic `sarif` rendering for code-scanning workflows.

CLI output ergonomics now also include `--output-file` for persisting the selected rendered format to disk without suppressing stdout.

CLI status ergonomics now also include `--summary-only` for compact terminal and CI checks without changing the underlying audit report model.

CLI defaults can now also be loaded from an explicit JSON file via `--config`, covering the stable fields `format`, `fail-on`, `summary-only`, and `output-file`.

The CLI now also ships an explicit `init-config` helper for scaffolding a starter `trustmcp.config.json` without overwriting an existing file.

The CLI now also ships an explicit `doctor` command for read-only first-use validation of targets and optional config files.

The repo now also ships static bash and zsh completion scripts for the stable CLI surface.

GitHub input ergonomics stay narrow: repository root inputs are accepted as full URLs or `gh:owner/repo`, while tree/blob/subpath URLs are rejected with a repository-root hint rather than normalized ambiguously.

JSON output now includes deterministic summary severity counters for `low`, `medium`, and `high` findings.

The public repo now also ships a reusable composite GitHub Action plus official example workflows for a checked-out repository target, an explicit public GitHub target, markdown artifact retention, SARIF artifact retention, and GitHub code-scanning SARIF upload, all pointing at the stable `v0.1.0` tag.

The reusable action now exposes machine-readable summary outputs for total findings and low/medium/high severity counts.

When running inside GitHub Actions with `GITHUB_STEP_SUMMARY` available, the reusable action also appends the existing markdown report there.

The reusable action now also accepts `output-file` for writing the selected rendered report to disk for later workflow steps.

README now includes pinned real-world scan snapshots for both a finding-producing public example and a no-match public example so visitors can see the tool's behavior more honestly.
