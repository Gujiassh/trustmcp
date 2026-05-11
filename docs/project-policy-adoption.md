# TrustMCP project-level policy adoption

This guide shows how to adopt TrustMCP as a **project-level policy tool** for one repository.

It is intentionally narrow:

- one repository at a time
- one `trustmcp.config.json`
- one optional baseline file
- one GitHub Action gate

This guide does **not** describe multi-repo aggregation, org-wide policy, or hosted dashboards.

## The four policy layers

For a single repository, TrustMCP exposes four practical layers:

1. **Raw findings**
   - all rule matches produced by the scanner
2. **Visible findings**
   - findings after `ignore-rules` and `ignore-paths`
3. **New findings**
   - visible findings not matched by the active baseline
4. **Gated findings**
   - the findings that actually drive `--fail-on`

Current policy behavior:

- if no baseline is active:
  - gated findings = visible findings
- if baseline is active:
  - gated findings = new findings

This means you can keep old findings visible while only failing CI on newly introduced risk.

## Recommended config layout

Create `trustmcp.config.json` at the repository root:

```json
{
  "format": "markdown",
  "fail-on": "high",
  "summary-only": false,
  "output-file": "reports/trustmcp.md",
  "ignore-rules": [],
  "ignore-paths": [],
  "baseline-file": "trustmcp.baseline.json"
}
```

Recommended use:

- put stable defaults in `trustmcp.config.json`
- use CLI flags or GitHub Action inputs only for explicit per-run overrides

Precedence is:

1. explicit CLI flags or Action inputs
2. `trustmcp.config.json`
3. built-in defaults

## When to use each control

### `ignore-rules`

Use when a whole rule is currently too noisy for this repository and you have already reviewed that risk.

Do not use it as a substitute for a baseline if you still want historical findings visible.

### `ignore-paths`

Use when a known path subtree should stay out of the visible report, for example generated or vendored content.

Path matching is literal and path-prefix based. There is no globbing.

### `baseline-file`

Use when the repository already has accepted findings and you want CI to focus only on newly introduced ones.

### `baseline-output`

Use when you want to generate or refresh the current accepted baseline snapshot.

## Baseline-first adoption flow

This is the recommended path for an existing repository with historical findings.

### Step 1: generate a baseline

```bash
node dist/cli/main.js . --config trustmcp.config.json --baseline-output trustmcp.baseline.json
```

This writes baseline entries with:

- `fingerprint`
- `ruleId`
- `file`
- optional `line`

### Step 2: commit the baseline

Check the generated file into version control after review.

This makes the accepted risk set explicit and reviewable.

### Step 3: gate on new findings only

Run TrustMCP with the same config in CI.

As long as `baseline-file` points to the checked-in baseline, `--fail-on` only evaluates the `newFindings` subset.

### Step 4: refresh intentionally

If the accepted risk inventory changes on purpose, regenerate the baseline and review the diff like any other policy change.

Do not regenerate blindly inside CI.

## Recommended GitHub Action pattern

Example workflow:

```yaml
name: TrustMCP baseline gate

on:
  pull_request:
  push:

permissions:
  contents: read

jobs:
  trustmcp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - run: mkdir -p reports

      - id: trustmcp
        uses: Gujiassh/trustmcp@v0.1.0
        with:
          target: ${{ github.workspace }}
          config-file: trustmcp.config.json

      - run: |
          echo "visible=${{ steps.trustmcp.outputs.finding-count }}"
          echo "new=${{ steps.trustmcp.outputs.new-finding-count }}"
          echo "gated=${{ steps.trustmcp.outputs.gated-finding-count }}"
          echo "baseline=${{ steps.trustmcp.outputs.baseline-applied }}"
          echo "summary=${{ steps.trustmcp.outputs.summary-message }}"
```

### How to read the outputs

- `finding-count`
  - all visible findings after ignore filtering
- `new-finding-count`
  - visible findings not matched by the baseline
- `gated-finding-count`
  - the set currently used for policy failure
- `baseline-applied`
  - whether the baseline was actually loaded

## Policy recommendations

Use this default posture unless you have a strong reason not to:

- use `ignore-*` only for known noise you want hidden from visibility
- use `baseline-file` for accepted historical findings you still want visible
- keep `fail-on` stable across local and CI runs
- review baseline changes like policy changes, not generated noise

## Common mistakes

- **Using `ignore-rules` instead of a baseline**
  - this hides findings instead of keeping them visible-but-accepted
- **Regenerating the baseline automatically in CI**
  - this erases review intent
- **Treating `summary.message` as the primary automation interface**
  - use the numeric JSON fields and action outputs instead
- **Assuming baseline removes historical findings from the report**
  - it only changes what is considered new/gated

## Related docs

- [TrustMCP machine-readable output contract](./machine-readable-output-contract.md)
- [TrustMCP troubleshooting](./troubleshooting.md)
- [TrustMCP rules explained](./trustmcp-rules.md)
