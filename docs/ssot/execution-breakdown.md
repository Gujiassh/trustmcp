# TrustMCP Execution Breakdown

This document turns the long-term development spec into a concrete execution plan.

Use it to decide what to build next, what to defer, and what “done” means for each slice.

For the higher-level product direction, see [TrustMCP Long-Term Development Spec](./long-term-development-spec.md).

## Planning Assumptions

- TrustMCP stays focused on JavaScript and TypeScript MCP repositories.
- The next priority is not broad feature count; it is stronger rule coverage plus better automation reliability.
- Each implementation slice should stay small enough to ship with tests, docs, and examples in one PR.
- Public output contracts should only change when the change is documented and intentionally versioned in release notes.

## Delivery Order

The work should be sequenced in this order:

1. Add one adjacent high-value rule family.
2. Harden the machine-readable output contract.
3. Close CI/report parity gaps, especially SARIF and JSON documentation.
4. Improve baseline and suppression ergonomics only where the current workflow is still clumsy.
5. Strengthen release discipline and adoption examples.

## Now / Next / Later

| Horizon | Theme | Outcome | Notes |
| --- | --- | --- | --- |
| Now | Rule expansion + output contract | TrustMCP becomes more useful in real CI without changing product scope. | `v0.2` foundation work |
| Next | Signal quality + policy ergonomics | Findings become easier to trust, suppress, and automate against. | `v0.3` quality work |
| Later | Adoption maturity | Docs, releases, and examples make the project feel operationally stable. | `v0.4+` polish |

## Immediate Execution Queue

These are the next recommended implementation slices in strict priority order.

## Foundation Slices Already Completed In `0.2.0-dev`

The first `v0.2` foundation wave has already landed on `main`. Do not treat these as future work unless a regression appears.

### Completed: Dynamic Code Execution And Adjacent Rule Expansion

TrustMCP now ships twelve capability-focused rules, including `mcp/dynamic-code-exec`, `mcp/script-runner-exec`, `mcp/env-secret-exposure`, `mcp/archive-extract`, `mcp/download-write-exec`, `mcp/local-service-binding`, `mcp/sensitive-local-data`, `mcp/subprocess-network-exfil`, and `mcp/tool-metadata-risk`.

Evidence:

- `src/rules/` contains the expanded rule set.
- `tests/audit.test.ts` asserts the full risky fixture inventory across twelve rules.
- `docs/trustmcp-rules.md` and `docs/what-trustmcp-scans.md` describe the current twelve-rule scanner surface.

### Completed: Machine-Readable Output Contract

The public machine-readable contract is now documented for JSON reports, findings, baseline entries, GitHub Action outputs, `list-rules --json`, and SARIF projection.

Evidence:

- `docs/machine-readable-output-contract.md` is the contract source.
- `tests/action.test.ts`, `tests/renderers.test.ts`, and `tests/cli.test.ts` cover the current structured outputs.

### Completed: Finding Fingerprint And Baseline Identity

Findings now carry stable fingerprints, generated baselines prefer fingerprint identity, and legacy tuple baseline entries remain accepted for compatibility.

Evidence:

- `src/core/baseline-entries.ts` defines fingerprint normalization and baseline entry conversion.
- `tests/audit.test.ts` covers fingerprint-first matching, empty baselines, and legacy tuple compatibility.
- `docs/project-policy-adoption.md` and `docs/troubleshooting.md` explain baseline usage.

### Completed: SARIF Parity Foundation

SARIF output now carries TrustMCP finding identity, baseline state, gated/new finding semantics, and rule metadata.

Evidence:

- `src/renderers/sarif.ts` projects fingerprint and baseline properties.
- `tests/renderers.test.ts` guards SARIF structure.
- `.github/examples/trustmcp-upload-sarif.yml` and related examples document adoption paths.

## Current Slice 1: Rule Metadata Consumer Examples

### Outcome

Make `list-rules --json` easier for downstream users to consume without reading source code or reverse-engineering the JSON shape.

### Why first

The machine-readable rule metadata now exists, but the next adoption gap is practical usage: users need copy-paste examples for extracting rule IDs, severities, confidence reason codes, and guidance in scripts or CI.

### Scope

- add or expand docs showing realistic `list-rules --json` consumption with `jq` or small shell snippets
- explain when to use rule metadata versus scan-report JSON
- keep examples focused on metadata inspection, not policy-language expansion
- update docs-coherence tests so this guidance cannot disappear silently

### Done means

- a user can copy one command to list rule IDs and severities
- a user can copy one command to inspect confidence reason codes for a rule
- docs distinguish rule metadata from per-run findings
- tests assert these entry points remain documented

### Suggested artifact set

- `README.md`
- `docs/machine-readable-output-contract.md`
- `docs/contributor-task-map.md`
- `tests/docs-coherence.test.ts`

## Current Slice 2: Release And Reference-Target Guardrail Tightening

### Outcome

Reduce maintainer memory required before a release by making the release/reference-target path easier to follow and harder to skip accidentally.

### Scope

- tighten docs around which release gate to run for code, docs-only, output-contract, and rule changes
- ensure reference-target manifest changes are tied to release notes and docs
- add tests only where a concrete doc invariant matters

### Done means

- maintainers can identify the right release gate without reading multiple files end-to-end
- release docs clearly separate `publish:check`, `release:check`, and `release:check:strict`
- docs discourage claiming release readiness when strict live reference scans were skipped

## Current Slice 3: Policy Ergonomics From Real Feedback

### Outcome

Improve baseline, ignore, or config ergonomics only after a concrete workflow pain point is identified.

### Scope

- do not add presets or nested policy syntax speculatively
- prefer docs and examples before new config fields
- if a new field is necessary, treat it as a public contract change

### Done means

- the change is tied to a real adoption problem
- docs explain when to use the feature and when not to
- tests cover the exact behavior or invariant being introduced

## Milestone Mapping

## `v0.2` milestone

Current status: mostly implemented on `main` as `0.2.0-dev`.

Already covered:

- expanded twelve-rule scanner surface
- machine-readable output contract docs
- finding fingerprint and baseline identity
- SARIF parity foundation
- baseline/action output parity
- release-confidence and package-readiness gates

Remaining release-readiness work:

- improve consumer-facing rule metadata examples
- keep roadmap docs aligned with the shipped surface
- run the full release gate before cutting the final `v0.2.0` tag

Release intent:

- stronger scanning value
- stronger automation confidence
- no product-scope drift

## `v0.3` milestone

Target slices:

- real-feedback-driven policy ergonomics
- continued false-positive and fixture quality improvements
- contributor workflow hardening as the rule set grows

Release intent:

- better policy ergonomics
- better long-term maintainability
- clearer suppression and baseline semantics

## `v0.4+` milestone

Target slices:

- optional rule-group ergonomics if real usage justifies them
- broader release/adoption maturity
- richer examples for teams and platform owners

Release intent:

- stronger project maturity
- easier external adoption
- lower maintainer memory burden

## Rules For Choosing The Next PR

Choose the next PR using these rules:

1. Prefer a slice that improves scanning value or contract clarity immediately.
2. Prefer a slice that can ship with docs and tests in one reviewable change.
3. Avoid mixing new rule logic with unrelated output-contract changes in the same PR.
4. Avoid adding config complexity before the baseline identity model is clearer.
5. If a slice changes public structured output, treat it as release-note-worthy by default.

## Recommended Next 3 PRs

If execution starts immediately, the best next three PRs are:

1. Finish refreshing roadmap and public docs so they no longer describe the original three-rule baseline.
2. Extend rule metadata ergonomics further, for example richer `list-rules --json` guidance and consumer-facing examples.
3. Keep tightening contributor guardrails and release/reference-target documentation so the larger shipped rule set stays maintainable.

That sequence keeps the repo's process memory aligned with the code that now exists, while continuing to improve automation and contributor safety without reopening product-scope drift.
