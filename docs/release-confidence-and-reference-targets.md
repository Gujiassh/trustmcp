# TrustMCP release confidence and reference targets

Use this guide when preparing a TrustMCP release slice that changes:

- rules
- finding identity
- machine-readable output
- SARIF rendering
- baseline semantics

This document is not about npm publication mechanics. It is about **confidence that the shipped scanner behavior is still honest and stable**.

For the final manual npm publication sequence, use [npm publish checklist](./npm-publish-checklist.md).

## Why this guide exists

TrustMCP has two kinds of release risk:

1. packaging risk
   - tarball contents
   - installability
   - versioning
2. scanner-behavior risk
   - changed findings
   - changed evidence
   - changed JSON / Action / SARIF contract
   - docs and examples drifting from reality

`npm run publish:check` already gives good packaging confidence.

This guide covers the second category.

The repository now also ships a lightweight reference-target manifest at `fixtures/reference-targets.json` plus a local validation command:

```bash
npm run reference:check
```

That command does not scan the internet. It validates that the checked-in reference-target set is still structurally usable and keeps the release workflow anchored to concrete public repositories.

If you want to run the actual current scans for those checked-in targets, use:

```bash
npm run reference:scan
```

That command is now opinionated enough to fail non-zero when the checked-in targets no longer match their declared categories:

- `finding-producing` must still produce at least one finding
- `mostly-clean` must still report zero findings
- `sarif-relevant` must still produce a meaningful scan result for SARIF inspection

Because those runs fetch real GitHub repository metadata and archives, they can take noticeably longer than local fixture checks. Treat them as release-confidence gates, not as a replacement for the fast deterministic local test suite.

When one reference target cannot be fetched or scanned, `reference:scan` keeps scanning the remaining targets and prints a target-level failure row plus a non-zero exit. That makes transient public GitHub archive or codeload failures diagnosable without discarding results from targets that completed successfully.

## Release gate chooser

Use the smallest gate that matches the slice, then run the broader release gate before a public release.

| Slice type | Minimum local gate | Use strict live reference scans when | Notes |
| --- | --- | --- | --- |
| Docs-only wording or navigation | `npm test -- tests/docs-coherence.test.ts` | The docs cite current real-target behavior. | Do not call this release-ready by itself. It only protects documented invariants. |
| Packaging or install-path changes | `npm run publish:check` | The change also affects scanner behavior or release-confidence examples. | This checks tarball/install readiness, not live scanner credibility. |
| Rule, finding, baseline, JSON, Action, or SARIF changes | `npm run release:check` | The release notes, README, or examples claim current real-target behavior. | Inspect fixture output and affected contract docs before relying on the gate. |
| `fixtures/reference-targets.json` changes | `npm run reference:check` plus `npm run reference:scan` | Always, unless the PR explicitly documents why live scans were skipped. | Update this guide's checked-in target list and the release notes/docs that depend on the target set. |
| Final public release candidate | `npm run release:check` | Use `npm run release:check:strict` when the release claims strict reference-target confidence. | If strict was skipped, say that directly; do not imply live reference targets were replayed. |

`npm run release:check:strict` is the only bundled gate that both validates package readiness and replays the current public reference targets. If it was not run, release notes should say `release:check` passed, not that strict live reference-target confidence passed.

Both commands also accept `--json` after the script, for example:

```bash
node scripts/reference-target-check.mjs --json
node scripts/reference-target-check.mjs --scan --json
```

If you want a single local pre-release gate that combines the reference-target manifest check with the existing packaging checks, run:

```bash
npm run release:check
```

If you also want to require the current public reference-target scans themselves to pass before release, run:

```bash
npm run release:check:strict
```

## Minimum release-confidence checklist

Run these for any release slice that changes scanning behavior or machine-readable outputs:

1. `npm test`
2. confirm `fixtures/local-risky` still produces the intended findings
3. confirm `fixtures/local-clean` still stays clean
4. re-read the public docs affected by the change
5. if JSON / baseline / Action outputs changed:
   - re-read [machine-readable output contract](./machine-readable-output-contract.md)
   - re-check any affected `list-rules --json` metadata and confidence guidance examples
6. if SARIF changed:
   - verify the SARIF example flow and renderer snapshot still align

If one of those steps is skipped, the release note or PR should explain why.

## Reference target strategy

In addition to local fixtures, TrustMCP should keep using a **small manually rechecked reference target set**.

The purpose is not to create flaky network-bound CI. The purpose is to keep maintainers grounded in what the tool looks like on real repositories.

## Recommended target categories

Keep at least one reference target in each category:

### 1. Finding-producing target

A public MCP repository expected to trigger at least one rule.

Use it to verify:

- evidence still looks believable
- rule IDs and severity presentation still make sense
- README examples remain honest

### 2. Mostly clean target

A public MCP repository expected to stay mostly or entirely clean.

Use it to verify:

- no-match messaging still looks honest
- false positives have not regressed badly
- README "clean example" claims still hold

### 3. SARIF-relevant target

A repository where the SARIF output is worth visually inspecting after renderer changes.

Use it to verify:

- result locations still line up
- rule metadata remains coherent
- fingerprint-carrying result properties remain present
- confidence metadata and rule-level guidance still line up with the JSON contract

## Current checked-in reference targets

The repository currently tracks these categories in `fixtures/reference-targets.json`:

- `finding-producing`
  - `https://github.com/microsoft/playwright-mcp`
- `mostly-clean`
  - `https://github.com/okooo5km/memory-mcp-server`
- `sarif-relevant`
  - `https://github.com/modelcontextprotocol/servers`

Treat these as maintainable defaults, not eternal truth. If a target stops fitting its category, update `fixtures/reference-targets.json`, this checked-in target list, and any release notes or public examples that depend on the target behavior in the same slice.

## How to use reference targets

Reference targets are for **manual confidence checks**, not for default automated test execution.

Recommended workflow:

1. choose the smallest relevant release slice
2. run local tests first
3. run `npm run reference:check`
4. run `npm run reference:scan`
5. if a target reports `scan failed`, inspect that target-level error before changing the manifest or release notes
6. compare the successful results to the expected category:
   - still finding-producing
   - still mostly clean
   - still SARIF-coherent
7. update docs/examples only if the scan output materially changed

## What to inspect on a reference run

Do not just look for exit code.

Inspect:

- finding count
- rule count
- whether `list-rules --json` metadata still matches the shipped rules
- whether the evidence still supports the rule claim
- whether confidence still feels justified
- whether the report still reads as a narrow capability review rather than vague security theater

For SARIF-related slices, also inspect:

- `partialFingerprints.primaryLocationLineHash`
- `properties.fingerprint`
- `properties.baselineApplied`
- `properties.isNewFinding`
- `properties.isGatedFinding`
- `properties.ruleId`
- `properties.confidenceReason`
- rule-level `confidenceLevels`, `confidenceReasons`, and `confidenceGuidance`
- line/location consistency
- whether a downstream consumer could align SARIF with JSON output

## When docs must be refreshed

Refresh docs if the reference-target behavior changes in a way users would notice, especially:

- different shipped rule inventory
- different baseline semantics
- different action outputs
- different SARIF properties
- changed README examples or no-match examples

## Relationship to fixtures

Use fixtures for deterministic regression coverage.

Use reference targets for release confidence and reality checks.

Do not confuse the two:

- fixtures prove intended behavior in CI
- reference targets prove the tool still feels credible in the wild

## Minimal per-slice decision rule

Before calling a scanning change release-ready, ask:

1. Are local fixtures green?
2. Does at least one real target still produce believable output?
3. If this slice changed structured output, does the contract doc still match reality?

If any answer is no, the slice is not yet release-ready.

## Related docs

- [npm publish checklist](./npm-publish-checklist.md)
- [TrustMCP machine-readable output contract](./machine-readable-output-contract.md)
- [TrustMCP rule contribution and regression corpus](./rule-contribution-and-regression-corpus.md)
