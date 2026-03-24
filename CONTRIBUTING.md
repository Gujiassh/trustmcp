# Contributing to TrustMCP

Thanks for helping make TrustMCP more useful.

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
- Preserve the finding contract: `ruleId`, `severity`, `confidence`, `title`, `file`, `line`, `evidence`, `whyItMatters`, and `remediation`.

## Rule changes

If you change a rule:

1. Add a positive fixture.
2. Add a negative fixture when false positives are plausible.
3. Update tests.
4. Update the README if the public behavior changes.

## Design boundaries

Please do not expand TrustMCP into a hosted platform, web UI, account system, or dynamic execution product as part of v0.1 maintenance. This repository is intentionally a narrow CLI.
