# TrustMCP machine-readable output contract

This document defines the current machine-readable contract for TrustMCP.

Use it when you want to:

- automate against CLI JSON output
- consume GitHub Action outputs in downstream workflow steps
- understand baseline identity and matching semantics

This document is about **stable structured fields**, not human-facing renderer wording.

## Stability policy

TrustMCP has two output layers:

- **Human-readable rendering**
  - text
  - markdown
  - summary-only text/markdown
- **Machine-readable contract**
  - JSON report
  - GitHub Action outputs
  - baseline JSON entries

Only the machine-readable layer is covered by this contract.

### Compatibility rules

- Existing documented JSON fields are treated as stable once shipped.
- Existing documented GitHub Action output keys are treated as stable once shipped.
- New fields may be added in a backward-compatible way.
- Existing fields must not be renamed, removed, or silently redefined without an explicit release-note-worthy contract change.
- Human-readable message wording is not a stable contract unless this document explicitly says otherwise.

## JSON report contract

The default full JSON report shape is:

```json
{
  "tool": {
    "name": "TrustMCP",
    "version": "0.1.0"
  },
  "target": {
    "input": "gh:owner/repo",
    "displayName": "owner/repo",
    "sourceType": "public-github-repo",
    "resolvedRef": "main@abc123"
  },
  "limitations": [],
  "summary": {},
  "findings": [],
  "newFindings": []
}
```

### Stable top-level fields

- `tool`
- `target`
- `limitations`
- `summary`
- `findings`
- `newFindings`

### `tool`

- `name`
  - stable string identifier for the scanner
- `version`
  - TrustMCP version used for the scan

### `target`

- `input`
  - original target argument
- `displayName`
  - normalized human-readable target label
- `sourceType`
  - one of:
    - `local-directory`
    - `public-github-repo`
- `resolvedRef`
  - optional resolved Git reference for GitHub sources

### `summary`

Stable fields:

- `baselineApplied`
- `findingCount`
- `newFindingCount`
- `gatedFindingCount`
- `triggeredRuleCount`
- `newTriggeredRuleCount`
- `gatedTriggeredRuleCount`
- `severityCounts.low`
- `severityCounts.medium`
- `severityCounts.high`
- `newSeverityCounts.low`
- `newSeverityCounts.medium`
- `newSeverityCounts.high`
- `gatedSeverityCounts.low`
- `gatedSeverityCounts.medium`
- `gatedSeverityCounts.high`
- `message`

### Summary semantics

- `baselineApplied`
  - `true` when baseline entries were loaded for the scan
  - `false` otherwise
- `findingCount`
  - total visible findings after ignore filtering
- `newFindingCount`
  - findings not matched by the active baseline
- `gatedFindingCount`
  - findings currently used for policy gating
  - equals `newFindingCount` when baseline is active
  - equals `findingCount` when baseline is not active
- `triggeredRuleCount`
  - unique rule IDs in `findings`
- `newTriggeredRuleCount`
  - unique rule IDs in `newFindings`
- `gatedTriggeredRuleCount`
  - unique rule IDs in the gated finding set
- `severityCounts`
  - counts over `findings`
- `newSeverityCounts`
  - counts over `newFindings`
- `gatedSeverityCounts`
  - counts over the policy-gated finding set
- `message`
  - human-readable one-line summary; stable enough to reuse, but downstream automation should prefer the numeric fields

## Finding contract

Each item in `findings` and `newFindings` has these stable fields:

- `fingerprint`
- `ruleId`
- `severity`
- `confidence`
- `title`
- `file`
- `line`
- `evidence`
- `whyItMatters`
- `remediation`

### Finding field semantics

- `fingerprint`
  - stable finding identity used for baseline matching
  - current format:
    - `ruleId|normalized-file-path|normalized-evidence`
  - consumers must treat it as an opaque stable identifier, not parse it for business logic
- `ruleId`
  - shipped rule identifier, for example `mcp/shell-exec`
- `severity`
  - one of `low`, `medium`, `high`
- `confidence`
  - one of `low`, `medium`, `high`
- `title`
  - human-readable finding title
- `file`
  - normalized slash-separated relative path
- `line`
  - optional positive integer location anchor
- `evidence`
  - normalized evidence snippet used to justify the finding
- `whyItMatters`
  - human-readable impact explanation
- `remediation`
  - human-readable mitigation guidance

## Baseline contract

Baseline files are JSON arrays.

TrustMCP supports two baseline entry shapes:

### Preferred current shape

```json
{
  "fingerprint": "mcp/shell-exec|src/shell.ts|exec(args.command);",
  "ruleId": "mcp/shell-exec",
  "file": "src/shell.ts",
  "line": 4
}
```

### Legacy compatible shape

```json
{
  "ruleId": "mcp/shell-exec",
  "file": "src/shell.ts",
  "line": 4
}
```

### Baseline matching semantics

- If `fingerprint` is present, TrustMCP matches by normalized fingerprint.
- Legacy tuple matching by `ruleId + file + line` is still supported for older baselines.
- New baseline files generated by TrustMCP use the preferred current shape.
- TrustMCP does not automatically rewrite existing baseline files in place.

## GitHub Action outputs

The reusable action emits these stable output keys:

- `finding-count`
- `rule-count`
- `low-count`
- `medium-count`
- `high-count`
- `new-finding-count`
- `new-rule-count`
- `new-low-count`
- `new-medium-count`
- `new-high-count`
- `gated-finding-count`
- `gated-rule-count`
- `gated-low-count`
- `gated-medium-count`
- `gated-high-count`
- `baseline-applied`
- `summary-message`

### Action output semantics

- `finding-count`
  - total visible findings after ignore filtering
- `rule-count`
  - unique rule count across visible findings
- `low-count`, `medium-count`, `high-count`
  - severity counts across visible findings
- `new-finding-count`
  - findings not matched by baseline
- `new-rule-count`
  - unique rule count across `newFindings`
- `new-low-count`, `new-medium-count`, `new-high-count`
  - severity counts across `newFindings`
- `gated-finding-count`
  - finding count used for policy gating
- `gated-rule-count`
  - unique rule count used for policy gating
- `gated-low-count`, `gated-medium-count`, `gated-high-count`
  - severity counts used for policy gating
- `baseline-applied`
  - `"true"` when baseline entries were loaded
  - `"false"` otherwise
- `summary-message`
  - the same one-line summary exposed in `summary.message`

## Policy semantics for machine consumers

TrustMCP currently exposes these practical layers:

- `findings`
  - visible findings after ignore filtering
- `newFindings`
  - baseline-filtered subset of visible findings
- `gated findings`
  - the subset used for exit-code / CI policy decisions
  - currently this is `newFindings` when baseline is active, otherwise `findings`
- action counts
  - derived from those same visible/new sets

Important behavior:

- `ignore-rules` and `ignore-paths` remove findings from the emitted visible sets
- `baseline-file` does not remove historical findings from `findings`; it only controls what lands in `newFindings`
- `--fail-on` gates on `newFindings` when baseline is active, otherwise on `findings`

## What is intentionally not guaranteed

This contract does **not** guarantee:

- exact markdown/text wording
- exact field ordering in markdown/text renderers
- exact SARIF cosmetic field wording beyond the normal stable mapping from findings
- that future additive machine fields will never appear

If you want the smallest stable automation surface, prefer:

- `summary.*` numeric fields
- `findings[].fingerprint`
- `findings[].ruleId`
- GitHub Action output keys listed above
