# TrustMCP contributor task map

Use this page when you know the job you need to do, but do not remember which file or command already covers it.

## Understand what TrustMCP is scanning

- Check out [What TrustMCP scans, and how it differs from npm audit](./what-trustmcp-scans.md) for the capability-scanning scope and non-goals.
- Check out [TrustMCP rules explained](./trustmcp-rules.md) for the current shipped rules and what each one is trying to catch.
- Run `node dist/cli/main.js list-rules` if you want the current shipped rule IDs from the CLI.

## Check or explain the current rule set

- Use [TrustMCP rules explained](./trustmcp-rules.md) when you need the public rule intent and boundaries.
- Use `node dist/cli/main.js list-rules` when you need a compact machine-friendly list.
- When changing a rule, follow the rule-change notes in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Troubleshoot setup or target problems

- Check out [TrustMCP troubleshooting](./troubleshooting.md) for current common errors.
- Run `node dist/cli/main.js doctor <target> [--config trustmcp.config.json]` for read-only target and config validation.
- Run `node dist/cli/main.js init-config` if you need a starter config file without overwriting an existing one.

## Install and use TrustMCP locally

- Check out [Installing TrustMCP today](./installing-trustmcp.md) for source checkout, direct `node dist/cli/main.js ...`, and `npm link`.
- Use the README quick start when you only need the shortest path.

## Validate package readiness

- Run `npm run pack:check` to validate the future npm tarball contents locally.
- Run `npm run publish:check` to bundle the current local release/package gates in one command.
- Check out [Installing TrustMCP today](./installing-trustmcp.md) if you need the honest explanation of what pack readiness does and does not mean.

## Prepare a release

- Check out [CHANGELOG.md](../CHANGELOG.md) for the public release history and the `Unreleased` section.
- Follow the manual GitHub release notes in [CONTRIBUTING.md](../CONTRIBUTING.md).
- Check out [the npm publish checklist](./npm-publish-checklist.md) for the final manual registry preflight when the project is actually ready to publish.

## Work on GitHub Actions examples or release utilities

- Look in `.github/examples/` for reusable-action workflows by job-to-be-done: workspace scans, public targets, artifacts, and SARIF upload.
- Look in `.github/workflows/` for repo-owned automation such as CI and the manual GitHub release workflow.

## When you need the public story, not maintainer workflow

- Use the README for the top-level product pitch and entry points.
- Use the docs pages above when you need the deeper explanation without repeating it in new docs.
