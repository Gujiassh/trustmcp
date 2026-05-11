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

## Slice 1: Dynamic Code Execution Rule

### Outcome

Add a new capability-focused rule for dynamic code execution patterns such as `eval(...)`, `new Function(...)`, and nearby user-input-driven dynamic execution paths.

### Why first

This is the closest high-signal expansion to the current threat model. It stays aligned with the core product promise and increases first-pass review value immediately.

### Scope

- add one new rule file under `src/rules/`
- register the rule in `src/rules/index.ts`
- add positive and negative fixtures
- add unit tests and renderer coverage where relevant
- update rule docs and README references

### Done means

- the new rule appears in `list-rules`
- the rule produces deterministic evidence strings
- at least one risky fixture matches
- at least one safe or intentionally non-matching fixture stays clean
- public docs explain what the rule is and is not claiming

### Suggested artifact set

- `src/rules/`
- `tests/rules.test.ts`
- `tests/audit.test.ts`
- `docs/trustmcp-rules.md`
- `README.md`

## Slice 2: Output Contract Spec

### Outcome

Document the current JSON and GitHub Action machine-readable contract as an explicit public interface.

### Why second

The project is already exposing more structured outputs. Before adding more fields, the current contract should be frozen and explained.

### Scope

- add a dedicated public doc for JSON summary, finding fields, and action outputs
- define compatibility expectations for adding or changing fields
- clarify which fields downstream workflows should treat as stable

### Done means

- a user can read one document and know which machine-readable fields are safe to automate against
- JSON summary fields and action outputs are listed explicitly
- docs explain the difference between human-readable rendering and machine-readable contract

### Suggested artifact set

- new doc under `docs/`
- `README.md`
- `docs/ssot/README.md`

## Slice 3: Finding Fingerprint And Baseline Identity Design

### Outcome

Define and implement a stable finding identity model that is strong enough for future baseline and suppression workflows.

### Why third

Baseline support exists today, but it is still a first-pass model. This slice gives future policy work a durable foundation.

### Scope

- define fingerprint semantics for findings
- decide whether fingerprinting remains internal-only first or becomes a public field
- align baseline matching docs with the chosen identity model
- add regression tests covering unchanged and moved findings where relevant

### Done means

- the project has one documented answer to “what makes two findings the same”
- future baseline and ignore behavior can build on that answer without re-litigating the model
- tests cover the chosen matching semantics

### Dependency note

If this slice adds or changes public JSON fields, it is a public contract change and should be called out explicitly in release notes.

## Slice 4: SARIF Parity Hardening

### Outcome

Make SARIF output more obviously aligned with the core TrustMCP report model and CI adoption story.

### Why fourth

SARIF matters for code-scanning workflows, but it should not lag behind the primary report model or feel under-documented.

### Scope

- compare SARIF rendering against the current report summary and finding model
- close obvious field parity gaps where appropriate
- add doc examples for upload and interpretation
- add tests that guard deterministic SARIF structure

### Done means

- SARIF output is clearly documented
- test coverage guards key SARIF fields and ordering
- the GitHub code-scanning example is still accurate after the changes

### Suggested artifact set

- `src/renderers/sarif.ts`
- `tests/renderers.test.ts`
- `.github/examples/`
- `README.md`

## Slice 5: Baseline And Ignore Workflow Cleanup

### Outcome

Make baseline adoption and ignore usage easier to understand without expanding into a full policy language.

### Why fifth

The current primitives are good enough to use, but still easy to misuse. This is a docs-plus-ergonomics slice, not a new abstraction layer.

### Scope

- clarify the recommended migration path for existing repositories
- document when to use `ignore-rules`, `ignore-paths`, and `baseline-file`
- tighten examples around “visibility shaping” versus “gating”
- add one or two realistic CI snippets for baseline-first adoption

### Done means

- a maintainer can tell which knob to use for which problem
- docs discourage permanent misuse of ignore fields
- at least one example shows a realistic baseline-gated workflow

## Slice 6: Regression Corpus And Contributor Guardrails

### Outcome

Make it harder to accidentally degrade signal quality when new rules are added.

### Why sixth

Once more rules exist, the real challenge becomes safe iteration, not just feature addition.

### Scope

- document rule contribution expectations more concretely
- define a regression corpus strategy using fixtures and a small reference target set
- update contributor docs to require public-doc alignment for rule changes

### Done means

- contributors have a clear checklist for adding or changing rules
- regression expectations are written down
- rule work no longer depends on maintainers remembering unwritten constraints

## Milestone Mapping

## `v0.2` milestone

Target slices:

- Slice 1: Dynamic Code Execution Rule
- Slice 2: Output Contract Spec
- Slice 4: SARIF Parity Hardening
- one scoped subset of Slice 5 where docs are currently weakest

Release intent:

- stronger scanning value
- stronger automation confidence
- no product-scope drift

## `v0.3` milestone

Target slices:

- Slice 3: Finding Fingerprint And Baseline Identity Design
- remaining Slice 5 work
- first half of Slice 6

Release intent:

- better policy ergonomics
- better long-term maintainability
- clearer suppression and baseline semantics

## `v0.4+` milestone

Target slices:

- remaining Slice 6 work
- release process hardening
- richer example set for teams and platform owners

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

1. Dynamic code execution rule.
2. Public machine-readable output contract doc.
3. SARIF parity hardening plus doc refresh.

That sequence keeps momentum high without taking on the harder baseline identity work too early.
