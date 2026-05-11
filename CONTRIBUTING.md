# Contributing to TrustMCP

Thanks for helping make TrustMCP more useful.

If you are trying to remember which doc or command covers which job, check out the [TrustMCP contributor task map](./docs/contributor-task-map.md).

## Local workflow

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build the CLI:

```bash
npm run build
```

Run the smoke demo:

```bash
npm run smoke
```

## What good contributions look like

- Keep the scope honest. TrustMCP is a static heuristic scanner, not a runtime sandbox.
- Prefer evidence-backed findings over broad claims.
- Add or update fixtures and tests with every rule change.
- Preserve the finding contract: `ruleId`, `severity`, `confidence`, optional `confidenceReason`, `title`, `file`, `line`, `evidence`, `whyItMatters`, and `remediation`.
- Follow the full rule-change and regression-corpus guidance in [docs/rule-contribution-and-regression-corpus.md](./docs/rule-contribution-and-regression-corpus.md).

## Rule changes

If you change a rule:

1. Add a positive fixture.
2. Add a negative fixture when false positives are plausible.
3. Update tests.
4. Update the README if the public behavior changes.

If the change affects finding identity, baseline semantics, Action outputs, JSON fields, `list-rules --json` metadata, or SARIF projection, also update the relevant contract docs and aggregate tests. Use [docs/rule-contribution-and-regression-corpus.md](./docs/rule-contribution-and-regression-corpus.md) as the source of truth for the full checklist.

## Design boundaries

Please do not expand TrustMCP into a hosted platform, web UI, account system, or dynamic execution product as part of the current product direction. This repository is intentionally a narrow CLI.

## Manual GitHub releases

This repository ships a conservative manual release workflow at `.github/workflows/release.yml`.

- run it with `workflow_dispatch`
- provide a tag like `v0.2.0`
- run it from the default branch
- make sure `package.json` already matches the same version without the leading `v`
- if the repo is on a development suffix such as `0.2.0-dev`, bump it to the final release version before running the workflow
- add or update the matching entry in `CHANGELOG.md`
- run `npm run release:check` before creating the release
- run `npm run pack:smoke` if you want a higher-confidence local check that the packed tarball can be installed and the CLI can start
- check [the npm publish checklist](./docs/npm-publish-checklist.md) before the final manual registry step

The workflow validates the version, runs tests and build, and then creates the GitHub tag and release. It does not publish to npm.

If the release slice changes scanner behavior, finding identity, Action outputs, JSON fields, or SARIF rendering, also walk through [docs/release-confidence-and-reference-targets.md](./docs/release-confidence-and-reference-targets.md) before treating the slice as ready.
