# TrustMCP contributor task map

Use this page when you know the job you need to do, but do not remember which file or command already covers it.

## Understand what TrustMCP is scanning

- Check out [What TrustMCP scans, and how it differs from npm audit](./what-trustmcp-scans.md) for the capability-scanning scope and non-goals.
- Check out [TrustMCP rules explained](./trustmcp-rules.md) for the current shipped rules and what each one is trying to catch.
- Run `node dist/cli/main.js list-rules` if you want the current shipped rule IDs from the CLI.
- Run `node dist/cli/main.js list-rules --json` if you need machine-readable rule metadata such as severity, `confidenceLevels`, `confidenceReasons`, or `confidenceGuidance`.

## Check or explain the current rule set

- Use [TrustMCP rules explained](./trustmcp-rules.md) when you need the public rule intent and boundaries.
- Use `node dist/cli/main.js list-rules` when you need a compact machine-friendly list.
- Use `node dist/cli/main.js list-rules --json` when a consumer needs stable rule metadata instead of just IDs and titles.
- Use `node dist/cli/main.js list-rules --json | jq -r '.[] | "\(.id)\t\(.severity)"'` when a consumer wants a compact rule/severity inventory.
- Use `node dist/cli/main.js list-rules --json | jq -r '.[] | select(.id == "mcp/outbound-fetch") | .confidenceReasons[]'` when a consumer wants the stable reason codes a specific rule can emit.
- When changing a rule, follow the rule-change notes in [CONTRIBUTING.md](../CONTRIBUTING.md).
- Use [TrustMCP rule contribution and regression corpus](./rule-contribution-and-regression-corpus.md) when you need the full maintainer checklist for fixtures, tests, docs, and contract-safe rule changes.

## Troubleshoot setup or target problems

- Check out [TrustMCP troubleshooting](./troubleshooting.md) for current common errors.
- Run `node dist/cli/main.js doctor <target> [--config trustmcp.config.json]` for read-only target and config validation.
- Run `node dist/cli/main.js init-config` if you need a starter config file without overwriting an existing one.

## Install and use TrustMCP locally

- Check out [Installing TrustMCP today](./installing-trustmcp.md) for source checkout, direct `node dist/cli/main.js ...`, and `npm link`.
- Use the README quick start when you only need the shortest path.

## Validate package readiness

- Run `npm run pack:check` to validate the future npm tarball contents locally.
- Run `npm run publish:check` when you only need the packaging-oriented local release/package gates.
- Check out [Installing TrustMCP today](./installing-trustmcp.md) if you need the honest explanation of what pack readiness does and does not mean.

## Prepare a release

- Check out [CHANGELOG.md](../CHANGELOG.md) for the public release history and the `Unreleased` section.
- Follow the manual GitHub release notes in [CONTRIBUTING.md](../CONTRIBUTING.md).
- Check out [the npm publish checklist](./npm-publish-checklist.md) for the final manual registry preflight when the project is actually ready to publish.
- Use [TrustMCP release confidence and reference targets](./release-confidence-and-reference-targets.md) when the release changes scanning behavior, machine-readable outputs, SARIF, or reference-target expectations.
- Use its [release gate chooser](./release-confidence-and-reference-targets.md#release-gate-chooser) to choose between docs-only, packaging-only, scanner/output, reference-target, and final release gates.
- Run `npm run reference:check` when you want to validate the checked-in reference-target manifest before a release-confidence pass.
- Run `npm run reference:scan` when you want to replay the current scans for those checked-in public reference targets.
- Run `npm run release:check` when you want the full local release-confidence + packaging gate in one command.
- Run `npm run release:check:strict` when you want the stricter gate that also requires current public reference targets to still match their declared categories.

## Work on GitHub Actions examples or release utilities

- Look in `.github/examples/` for reusable-action workflows by job-to-be-done: workspace scans, public targets, PR comments, artifacts, and SARIF upload.
- Look in `.github/workflows/` for repo-owned automation such as CI and the manual GitHub release workflow.

## Add or tighten a rule safely

- Start with [TrustMCP rule contribution and regression corpus](./rule-contribution-and-regression-corpus.md).
- Then update the smallest relevant fixture, unit tests, aggregate tests, and public docs together.

## When you need the public story, not maintainer workflow

- Use the README for the top-level product pitch and entry points.
- Use the docs pages above when you need the deeper explanation without repeating it in new docs.
