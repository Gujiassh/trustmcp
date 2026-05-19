# TrustMCP demo walkthrough

Use this page when you want a short, repeatable TrustMCP demo.

There are two useful paths:

- an npm-first demo for first-time users
- a source-checkout fixture demo that does not depend on live public repositories

If you only need install variants, use [Installing TrustMCP today](./installing-trustmcp.md).

## Fastest first demo with `npx`

Requires Node.js 18.18+.

Run:

```bash
npx trustmcp --version
npx trustmcp gh:modelcontextprotocol/servers --format text
```

Use this path when you want to validate the published package and scan a public repository root immediately.

If you want a compact CI-style result instead of the full finding list, run:

```bash
npx trustmcp gh:modelcontextprotocol/servers --summary-only --fail-on high
```

This path is intentionally network-dependent because it uses npm and a live GitHub repository.

## Reproducible local demo with bundled fixtures

Use this path when you want a stable demo that does not depend on current public repository behavior.

Clone and build:

```bash
git clone https://github.com/Gujiassh/trustmcp.git
cd trustmcp
npm install
npm run build
```

Run the risky fixture summary:

```bash
node dist/cli/main.js ./fixtures/local-risky --summary-only
```

Expected summary:

```text
TrustMCP v0.2.0-dev
Target: .../fixtures/local-risky
Source: local-directory
Summary: 23 finding(s) across 13 rule(s). Static heuristics only.
```

Run the clean fixture summary:

```bash
node dist/cli/main.js ./fixtures/local-clean --summary-only
```

Expected summary:

```text
TrustMCP v0.2.0-dev
Target: .../fixtures/local-clean
Source: local-directory
Summary: No matching rules were triggered. Static heuristics only; this does not mean the target is safe.
```

Use the full text report when you want to show concrete evidence lines and remediation text:

```bash
node dist/cli/main.js ./fixtures/local-risky --format text
```

Use JSON when you want to show the machine-readable summary contract:

```bash
node dist/cli/main.js ./fixtures/local-risky --format json --summary-only
```

The current risky fixture is expected to report:

- 23 findings
- 13 triggered rules
- 14 high-severity findings
- 9 medium-severity findings

Those numbers come from the checked-in fixture corpus, so this demo should only change when the fixture corpus or shipped rule set changes.

## Combined local smoke demo

If you want the existing local smoke script, run:

```bash
npm run smoke
```

The smoke script prints both text and JSON output for `fixtures/local-risky`. It is useful for maintainers, but the two summary commands above are shorter for demos.

## Package-readiness checks for the next release

When the conversation moves from "does the scanner work?" to "is this repository ready for another package cut?", use the release gates instead of the demo commands:

```bash
npm run pack:check
npm run pack:smoke
npm run publish:check
```

For scanner or output-contract changes, use the release gate chooser in [TrustMCP release confidence and reference targets](./release-confidence-and-reference-targets.md#release-gate-chooser).
