# TrustMCP troubleshooting

Use this page when TrustMCP fails before a scan, rejects an input shape, or prints a result you did not expect.

For a quick first-pass check, run:

```bash
node dist/cli/main.js doctor <target> [--config trustmcp.config.json]
```

## Common problems

| Problem | What it usually means | What to do |
| --- | --- | --- |
| `GitHub tree URLs are not supported.` or `GitHub blob URLs are not supported.` | You passed a copied GitHub link like `.../tree/main/...` or `.../blob/main/...`. TrustMCP only accepts repository roots. | Change the target to the repo root, like `https://github.com/owner/repo` or `gh:owner/repo`. |
| `GitHub shorthand inputs must look like gh:<owner>/<repo>.` | The `gh:` shorthand is malformed. | Use `gh:owner/repo`. Do not include extra path segments like `tree/main` or `blob/...`. |
| `Local directory not found:` | The local path does not exist from your current shell location. | Check the path, or pass an absolute path. `doctor` is the fastest way to confirm the target shape before a real scan. |
| `Local path is not a directory:` | The path exists, but it points to a file instead of a directory. | Point TrustMCP at the repository or folder root, not an individual file. |
| `Config file ... must contain valid JSON` or `Config file ... has invalid ...` | The config file exists, but its JSON or supported field values are invalid. | Keep the config to the supported fields only: `format`, `fail-on`, `summary-only`, and `output-file`. If you want a clean starting point, run `node dist/cli/main.js init-config`. |
| `Output file directory does not exist:` | You used `--output-file` with a parent directory that is missing. | Create the parent directory first, then run TrustMCP again. TrustMCP writes the report file, but it does not scaffold report directories for you. |
| `No matching rules were triggered.` | The current shipped rules did not match the current repository snapshot. | Treat this as a narrow no-match result, not a safety verdict. Check [What TrustMCP scans, and how it differs from npm audit](./what-trustmcp-scans.md) if you want the scope explanation. |

## When a GitHub target is rejected

TrustMCP accepts GitHub repository roots only:

- `https://github.com/owner/repo`
- `gh:owner/repo`

It does **not** accept:

- `.../tree/<branch>/...`
- `.../blob/<branch>/...`
- issue, pull request, or subpath URLs

If you copied a link from the browser, trim it back to the repository root and retry.

## When config-backed runs fail

TrustMCP does not auto-discover config files. If you use config-backed defaults, pass them explicitly:

```bash
node dist/cli/main.js gh:modelcontextprotocol/servers --config trustmcp.config.json
```

If you are starting from scratch, generate a safe starter file:

```bash
node dist/cli/main.js init-config
```

Then edit only the supported fields.

## When output files fail

`--output-file` writes the already-rendered report to disk. It does not suppress stdout, and it does not create missing directories.

This works:

```bash
mkdir -p reports
node dist/cli/main.js gh:modelcontextprotocol/servers --format json --output-file reports/trustmcp.json
```

This fails because the parent directory does not exist:

```bash
node dist/cli/main.js gh:modelcontextprotocol/servers --format json --output-file reports/trustmcp.json
```

## When you are not sure what TrustMCP is checking

TrustMCP currently ships three rules.

To list them from the CLI:

```bash
node dist/cli/main.js list-rules
```

For the rule-by-rule explanation, check out [TrustMCP rules explained](./trustmcp-rules.md).
