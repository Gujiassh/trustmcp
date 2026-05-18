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

TrustMCP now ships thirteen capability-focused rules, including `mcp/dynamic-code-exec`, `mcp/script-runner-exec`, `mcp/env-secret-exposure`, `mcp/internal-network-access`, `mcp/archive-extract`, `mcp/download-write-exec`, `mcp/local-service-binding`, `mcp/sensitive-local-data`, `mcp/subprocess-network-exfil`, and `mcp/tool-metadata-risk`.

Evidence:

- `src/rules/` contains the expanded rule set.
- `tests/audit.test.ts` asserts the full risky fixture inventory across thirteen rules.
- `docs/trustmcp-rules.md` and `docs/what-trustmcp-scans.md` describe the current thirteen-rule scanner surface.

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

## Completed Recent Slices

### Completed: Rule Metadata Consumer Examples

Status: completed on `main`.

Outcome:

`list-rules --json` is easier for downstream users to consume without reading source code or reverse-engineering the JSON shape.

Evidence:

- `README.md` shows copy-paste `jq` examples for rule IDs, severities, and confidence reason codes.
- `docs/machine-readable-output-contract.md` explains that `list-rules --json` is rule inventory metadata, not per-run finding JSON.
- `docs/contributor-task-map.md` points maintainers to compact rule/severity and confidence reason commands.
- `tests/docs-coherence.test.ts` guards the rule metadata examples and metadata-vs-report distinction.

### Completed: Release And Reference-Target Guardrail Tightening

Status: completed on `main`.

Outcome:

Release and reference-target paths are easier to follow and harder to overstate.

Evidence:

- `docs/release-confidence-and-reference-targets.md` includes a release gate chooser for docs-only, packaging, scanner/output, reference-target manifest, and final release slices.
- `docs/npm-publish-checklist.md` says `release:check` does not replay live public reference-target scans and points to `release:check:strict` when release notes or public examples claim live reference-target confidence.
- `README.md` and `docs/contributor-task-map.md` link maintainers to the gate chooser.
- `tests/docs-coherence.test.ts` guards the `publish:check` / `release:check` / `release:check:strict` boundary and checks the reference-target manifest stays reflected in release-confidence docs.

### Completed: CLI Argument Parsing Boundary Cleanup

Status: completed on `main` as architecture maintenance after the global drift audit.

Outcome:

The CLI entrypoint is back to command dispatch and scan execution orchestration instead of owning argument parsing.

Evidence:

- `src/cli/arguments.ts` owns CLI command parsing, command type guards, usage text, and option resolution.
- `src/cli/main.ts` imports those helpers and stays focused on executing parsed commands.
- `tests/cli-arguments.test.ts` covers parser behavior separately from `tests/cli.test.ts` execution behavior.
- `docs/ssot/README.md` records the CLI responsibility boundary.

### Completed: Internal Network Access Rule Family

Status: completed on `main`.

Outcome:

TrustMCP now separates local, private, link-local metadata-service, `.local`, and `.internal` network targets from generic outbound fetch capability without broadening into general SAST or DNS reputation scoring.

Evidence:

- `src/rules/internal-network-access.ts` implements the narrow rule with stable high-confidence reason codes.
- `fixtures/local-risky/src/internal.ts` and `fixtures/baseline-local-risky.json` record the regression fixture and baseline identity.
- `tests/rules.test.ts`, `tests/audit.test.ts`, and `tests/cli.test.ts` cover rule boundaries, risky fixture inventory, and `list-rules` metadata.
- `docs/trustmcp-rules.md`, `docs/what-trustmcp-scans.md`, and `README.md` document the thirteen-rule surface and the intentional overlap with `mcp/outbound-fetch`.

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

- expanded thirteen-rule scanner surface, including internal/local network access
- machine-readable output contract docs
- finding fingerprint and baseline identity
- SARIF parity foundation
- baseline/action output parity
- release-confidence and package-readiness gates

Remaining release-readiness work:

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

## Recommended Next Slices

If execution starts immediately, the best next slices are:

1. Improve baseline, ignore, or config ergonomics only where a real workflow pain point has been identified.
2. Expand public examples for realistic CI, team, platform-owner, or multi-repo usage without broadening product scope.

That sequence keeps the repo's process memory aligned with the code that now exists, while continuing to improve automation and contributor safety without reopening product-scope drift.
