# TrustMCP

> Static risk audit for JS/TS MCP servers before you run them.

TrustMCP is a narrow static audit CLI for JavaScript and TypeScript MCP server repositories that flags a few high-signal risk patterns before you run them.

If `npm audit` is the mental model that brought you here, keep the comparison loose: TrustMCP does **not** use CVE feeds, dependency advisories, or runtime analysis. It is a small source-level preflight check.

Canonical repository: https://github.com/Gujiassh/trustmcp

## Why now

MCP servers are getting easier to discover and easier to wire into local tools. Trust review is still mostly manual, so TrustMCP focuses on a believable first step: scan the code, point to concrete evidence, and explain why it matters.

TrustMCP v0.1 intentionally stays small:

- one local CLI
- static heuristics only
- public GitHub repo root URLs or local folders
- three evidence-backed rules

It does **not** claim a target is safe.

## What v0.1 checks

- `mcp/shell-exec`
- `mcp/outbound-fetch`
- `mcp/broad-filesystem`

Every finding includes:

- `ruleId`
- `severity`
- `confidence`
- `title`
- `file`
- `line` when available
- `evidence`
- `whyItMatters`
- `remediation`

## Quickstart

TrustMCP is **not published to npm yet**. The supported v0.1 path is source checkout, local build, then either `node dist/cli/main.js ...` or `npm link`.

Install dependencies:

```bash
npm install
```

Build the CLI:

```bash
npm run build
```

Optional: link the local CLI command:

```bash
npm link
trustmcp ./fixtures/local-risky
```

Scan a local folder:

```bash
node dist/cli/main.js ./fixtures/local-risky
```

Scan a public GitHub repo:

```bash
node dist/cli/main.js https://github.com/modelcontextprotocol/servers --format text
```

GitHub scans currently accept **repo root URLs only** and fetch the current default-branch snapshot of the public repository.

Emit JSON for CI or other tooling:

```bash
node dist/cli/main.js ./fixtures/local-risky --format json
```

Fail a CI job when a finding meets or exceeds a severity threshold:

```bash
node dist/cli/main.js https://github.com/modelcontextprotocol/servers --format json --fail-on high
```

`--fail-on low` fails on any finding, `--fail-on medium` fails on medium or high findings, and `--fail-on high` fails on high findings only. Threshold matches exit with code `2`; TrustMCP runtime or argument errors exit with code `1`.

Run the included checks:

```bash
npm test
npm run build
npm run smoke
```

## Example output

```text
TrustMCP v0.1.0
Target: /absolute/path/to/local-risky
Source: local-directory
Summary: 3 finding(s) across 3 rule(s). Static heuristics only.

[HIGH][HIGH] Shell execution capability detected
Rule: mcp/shell-exec
Location: src/shell.ts:4
Evidence: exec(args.command);
Why it matters: Shell execution can turn tool input into arbitrary host commands.
Remediation: Prefer fixed command allowlists, avoid shell string interpolation, and require explicit operator approval for host command execution.
```

When no rules match, TrustMCP says:

```text
No matching rules were triggered.
```

That message is intentionally narrow. It is **not** a safety verdict.

## Limitations

TrustMCP is honest about scope:

- static heuristics only
- JavaScript and TypeScript repositories only
- no runtime sandboxing
- no private repo support
- GitHub input is best-effort for small public repositories
- GitHub input currently supports repo root URLs only, not branch/tree/blob URLs
- no auth flows
- no web UI, registry, or hosted service
- no guarantee that a target is safe or complete coverage of all MCP risks

This first release is designed for a 60-second demo and a practical first pass, not a full security review.

## Contribution path

The easiest way to contribute is to add a fixture, add or tighten a rule, and keep the output contract stable. Check out [CONTRIBUTING.md](./CONTRIBUTING.md) for the local workflow.

## Security reporting

If you find a bug in TrustMCP itself, follow [SECURITY.md](./SECURITY.md).
