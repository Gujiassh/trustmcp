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

Or use explicit GitHub shorthand:

```bash
node dist/cli/main.js gh:modelcontextprotocol/servers --format text
```

GitHub scans accept **repository root inputs only**: either `https://github.com/owner/repo` or `gh:owner/repo`. Trailing slashes, `.git`, and repo-root query fragments are normalized for full URLs. Copied `tree/...`, `blob/...`, and other GitHub subpath URLs are rejected with a hint to use the repository root URL instead. Invalid shorthand fails with `gh:<owner>/<repo>` guidance rather than falling through to local-path handling.

Emit JSON for CI or other tooling:

```bash
node dist/cli/main.js ./fixtures/local-risky --format json
```

Emit compact markdown for a PR comment or job summary:

```bash
node dist/cli/main.js gh:modelcontextprotocol/servers --format markdown
```

Write the selected format to a file while still printing it to stdout:

```bash
node dist/cli/main.js gh:modelcontextprotocol/servers --format markdown --output-file trustmcp-report.md
```

JSON reports include `summary.severityCounts.low`, `summary.severityCounts.medium`, and `summary.severityCounts.high` so CI consumers can read stable severity totals without re-counting the finding list.

Fail a CI job when a finding meets or exceeds a severity threshold:

```bash
node dist/cli/main.js https://github.com/modelcontextprotocol/servers --format json --fail-on high
```

`--fail-on low` fails on any finding, `--fail-on medium` fails on medium or high findings, and `--fail-on high` fails on high findings only. Threshold matches exit with code `2`; TrustMCP runtime or argument errors exit with code `1`.

## GitHub Actions example

TrustMCP now ships a reusable composite action at the repository root. For a copy-pasteable workflow, start from [`./.github/examples/trustmcp-gate.yml`](./.github/examples/trustmcp-gate.yml).

Minimal external usage looks like this:

```yaml
jobs:
  trustmcp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: trustmcp
        uses: Gujiassh/trustmcp@v0.1.0
        with:
          target: ${{ github.workspace }}
          format: json
          fail-on: high
      - run: |
          echo "findings=${{ steps.trustmcp.outputs.finding-count }}"
          echo "high=${{ steps.trustmcp.outputs.high-count }}"
```

The action builds TrustMCP from its own source tree on each run and then scans the checked-out target path or public GitHub URL you pass in. It does not rely on a published npm package or marketplace wrapper. The example above uses the current stable tag `v0.1.0`; if you need stricter supply-chain pinning, use a specific commit SHA.

The reusable action exposes `finding-count`, `low-count`, `medium-count`, and `high-count` outputs derived from the same report summary that the CLI emits in JSON.

When `GITHUB_STEP_SUMMARY` is available, the reusable action also appends the compact TrustMCP markdown report there automatically for easier job review.

## Real-world pinned example

At pinned ref `eed21856dcf0defa23394909e27125311fed246f`, TrustMCP reported the following on `microsoft/playwright-mcp`:

```text
Target: microsoft/playwright-mcp
Ref: main@eed21856dcf0defa23394909e27125311fed246f
Summary: 4 finding(s) across 1 rule(s). Static heuristics only.

[HIGH][HIGH] Shell execution capability detected
Rule: mcp/shell-exec
Location: packages/playwright-mcp/update-readme.js:149
Evidence: execSync('node cli.js --help > help.txt');
```

This is a point-in-time heuristic capability match, not a blanket judgment of the project. In this case, TrustMCP matched shell execution in repository scripts and maintenance paths, which is exactly the kind of capability surface this tool is meant to surface before deeper review.

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
- GitHub input supports repository root URLs only; tree/blob/subpath URLs are rejected instead of being scanned ambiguously
- no auth flows
- no web UI, registry, or hosted service
- no guarantee that a target is safe or complete coverage of all MCP risks

This first release is designed for a 60-second demo and a practical first pass, not a full security review.

## Contribution path

The easiest way to contribute is to add a fixture, add or tighten a rule, and keep the output contract stable. Check out [CONTRIBUTING.md](./CONTRIBUTING.md) for the local workflow.

## Security reporting

If you find a bug in TrustMCP itself, follow [SECURITY.md](./SECURITY.md).
