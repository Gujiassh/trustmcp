# Source Install And Packaging Notes

TrustMCP is already published on npm, but source checkout still matters for contributors, local inspection, and pre-release work on the unreleased repository surface.

This page exists to keep three ideas separate:

- **installing the published package today**
- **running the current repository from source**
- **preparing the next package/release without publishing immediately**

## What is real today

TrustMCP is published on npm as `trustmcp`.

Current supported ways to use it are:

- `npm install -g trustmcp`
- `npx trustmcp ...`
- direct `node dist/cli/main.js ...` from a built source checkout
- optional `npm link` from that same local source checkout

If you want the concrete install paths, use [Installing TrustMCP today](./installing-trustmcp.md).

## Why source checkout still matters

Even with npm publication live, a source checkout is still the right path when you need to:

- inspect or modify the repository
- validate unreleased behavior such as `0.2.0-dev`
- run fixture, contract, and release-confidence checks before tagging a release
- use `npm run smoke`, `npm run reference:check`, or `npm run release:check`

## What packaging and release checks mean now

These commands are no longer placeholders for a hypothetical future package. They are the local validation path for future releases of the already-published package.

- `npm run pack:check`
  - validates the tarball file set
- `npm run pack:smoke`
  - validates that the packed tarball can be installed and started
- `npm run publish:check`
  - runs the packaging-oriented local release gate
- `npm run release:check`
  - runs the broader local release-confidence gate, including reference-target checks

None of these commands publish anything by themselves.

## What this page is not saying

This page is **not** saying:

- the current repository tip has already been published
- every example in this repo is available from the last npm tag
- a local check automatically creates a GitHub release or npm release

It only separates **published package usage** from **unreleased repo-surface validation** so users and maintainers do not confuse the two.

## Use the right doc for the current job

- For current install steps, check out [Installing TrustMCP today](./installing-trustmcp.md).
- For package/release preflight, check out [the npm publish checklist](./npm-publish-checklist.md).
- For release-confidence target replay and manual scanner confidence checks, check out [TrustMCP release confidence and reference targets](./release-confidence-and-reference-targets.md).
