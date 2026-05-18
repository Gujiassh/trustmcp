# TrustMCP rule contribution and regression corpus

This guide defines the minimum engineering discipline for changing TrustMCP rules.

Use it when you are:

- adding a new rule
- tightening an existing rule
- reducing false positives
- changing finding identity, evidence, or output contract behavior

The goal is simple:

> contributors should be able to change TrustMCP without silently damaging trust, output stability, or fixture coverage.

## Contribution checklist for rule changes

Every rule change must satisfy all of these unless there is a documented exception:

1. **Positive fixture**
   - add or update at least one risky fixture that should match
2. **Negative fixture**
   - add or preserve at least one intentionally non-matching example when false positives are plausible
3. **Unit coverage**
   - update `tests/rules.test.ts` or a more specific equivalent
4. **Audit pipeline coverage**
   - update `tests/audit.test.ts` when the shipped rule inventory or aggregate report changes
5. **Public docs**
   - update:
     - `docs/trustmcp-rules.md`
     - `README.md`
   - and any contract doc affected by the change
6. **Output stability**
   - if finding shape, summary fields, baseline identity, rule metadata, or action outputs change, update:
     - tests
     - `docs/machine-readable-output-contract.md`
     - release notes if appropriate

If one of these does not apply, explain why in the PR description.

## Regression corpus strategy

TrustMCP currently uses two fixture classes:

### 1. Local deterministic fixtures

Primary in-repo corpus under `fixtures/`:

- `fixtures/local-risky`
  - representative positive matches for shipped rules
- `fixtures/local-clean`
  - known non-match baseline for the current rule set

These fixtures are the first line of regression protection.

Rules:

- prefer small files over large pseudo-projects
- each fixture file should make one capability pattern obvious
- evidence snippets should stay deterministic
- fixture paths should remain stable unless the change itself requires a path change

### 2. Reference target set

Use a small, manually rechecked reference target set for release confidence, not for default automated CI:

- one target expected to produce findings
- one target expected to stay mostly or entirely clean
- one target with SARIF/code-scanning relevance when practical

This set does not need to be codified as always-on tests yet, but it should be written down in release workflow notes and reused consistently.

The repository now keeps that set in `fixtures/reference-targets.json`, `npm run reference:check` validates that the manifest still has the expected category coverage and GitHub-root URL shape, and `npm run reference:scan` replays the current scans for those checked-in targets.

## What belongs in fixtures

A good TrustMCP fixture should:

- isolate the capability pattern clearly
- keep surrounding code minimal
- use realistic enough naming that confidence heuristics still matter
- avoid accidental matches from unrelated APIs

Examples:

- `src/shell.ts` for process execution
- `src/network.ts` for outbound fetch
- `src/files.ts` for broad filesystem access
- `src/dynamic.ts` for dynamic code execution

## What does not belong in fixtures

Avoid fixtures that:

- bundle many unrelated risky behaviors into one file
- depend on runtime execution
- depend on external network access
- rely on unstable generated content
- require downstream consumers to infer why the rule matched

## Evidence-quality expectations

A rule change is not complete unless its evidence string stays reviewable.

For every new or changed rule:

- the evidence should point to the matched capability clearly
- the evidence should be deterministic across repeated runs
- the evidence should be short enough for human review
- fingerprint stability should be considered when evidence changes

If you change evidence generation, ask:

- does this break baseline identity?
- does this require a contract doc update?
- does this need a migration note for existing baseline files?

## When aggregate tests must be updated

You must update aggregate tests when the change affects:

- total finding count
- triggered rule count
- baseline/new/gated counts
- list-rules output
- confidence metadata such as `confidenceReason`, `confidenceLevels`, `confidenceReasons`, or `confidenceGuidance`
- JSON summary shape
- Action outputs
- SARIF stable projection

In this repository, that usually means touching one or more of:

- `tests/audit.test.ts`
- `tests/renderers.test.ts`
- `tests/cli.test.ts`
- `tests/action.test.ts`

## Public-doc alignment rule

If the user-facing behavior changes, docs are part of the implementation.

At minimum, check whether the change requires updates to:

- `README.md`
- `docs/trustmcp-rules.md`
- `docs/troubleshooting.md`
- `docs/machine-readable-output-contract.md`
- `docs/project-policy-adoption.md`

Do not treat docs as optional cleanup after the code lands.

## Release-confidence checklist

Before shipping a rule-related release slice:

1. run `npm test`
2. confirm the local risky fixture still matches the intended rules
3. confirm the local clean fixture stays clean
4. confirm docs and examples still describe the current rule set honestly
5. if SARIF or JSON changed, re-read the contract doc and renderer snapshot together
6. if `list-rules --json` metadata changed, verify the rule metadata snapshot and any contributor-facing guidance that points to it
7. if release-confidence target guidance changed, run `npm run reference:check` and update the manifest/docs together

## Practical decision rules

When you are unsure how broad a rule should be:

- prefer one narrower rule with good evidence over one broader rule with vague evidence
- prefer a stable fingerprint over a clever but noisy evidence string
- prefer adding one more explicit fixture over relying on reviewer intuition

When you are unsure whether to add a new rule or extend an old one:

- extend the old rule if the trust question is the same
- add a new rule if the capability category is meaningfully different for reviewers and policy

## Related docs

- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [TrustMCP contributor task map](./contributor-task-map.md)
- [TrustMCP rules explained](./trustmcp-rules.md)
- [TrustMCP machine-readable output contract](./machine-readable-output-contract.md)
