# TrustMCP Long-Term Development Spec

This document describes the long-range product and engineering plan for evolving TrustMCP beyond the current `0.2.0-dev` baseline.

It is intentionally product-shaped rather than issue-shaped: the point is to keep future work aligned with the core promise of the project instead of growing a pile of unrelated scanner features.

For the implementation-level sequencing and next recommended slices, see [TrustMCP Execution Breakdown](./execution-breakdown.md).

## Summary

TrustMCP should become the practical first-pass trust review tool for JavaScript and TypeScript MCP server repositories.

That means:

- maintain a narrow, honest scope
- improve rule coverage in capability areas that matter before first use
- make findings easier to consume in CI and review flows
- harden output contracts so downstream automation can depend on them
- keep evidence quality high enough that users trust a finding as a reason to look closer

TrustMCP should **not** drift into a general-purpose SAST platform, hosted security service, or black-box “trust score” product.

## Current Baseline

As of the current `0.2.0-dev` repository baseline, TrustMCP already provides:

- a Node.js CLI
- a reusable GitHub Action
- local directory and public GitHub repository inputs
- text, JSON, Markdown, summary-only, and SARIF output paths
- baseline, ignore, config, doctor, init-config, and list-rules workflows
- twelve capability-focused rules covering:
  - command execution
  - outbound fetch and exfiltration chains
  - broad filesystem and sensitive local data access
  - dynamic code execution
  - download/write/execute chains
  - archive extraction
  - local listener startup
  - environment secret exposure
  - risky tool metadata

This is a usable early product, but it is still maturing in four important ways:

1. Rule coverage is materially stronger than the initial baseline, but new capability families should still be added only when they preserve evidence quality.
2. Finding quality and suppression ergonomics are good enough for early adopters, but still need real-feedback-driven refinement before broad CI standardization.
3. Workflow outputs now have an explicit public contract, so future additions must preserve compatibility and documentation discipline.
4. Project-level trust still depends heavily on docs clarity, release discipline, and regression safety, not just feature count.

## Product Thesis

People adopt MCP servers faster than they review them.

TrustMCP wins if it helps a developer, reviewer, or platform owner answer this question quickly:

> “What risky host capabilities does this MCP server appear to expose before I wire it into my tools or CI?”

That implies three product principles:

1. Capability-first, not vulnerability-theater.
   TrustMCP should focus on evidence-backed capability exposure, not generic severity theater or speculative scoring.

2. Honest outputs beat broad promises.
   The scanner should prefer narrow claims with good evidence over wide claims with weak confidence.

3. CI usefulness matters as much as terminal readability.
   The product is not complete when a human can read the report; it is complete when humans and automation can both use it reliably.

## Goals

### Primary goals

- Expand the rule set to cover the most important MCP risk surfaces without diluting signal quality.
- Make TrustMCP outputs stable enough for real CI policy, PR review, and artifact retention workflows.
- Reduce false positives and improve explainability so findings are easier to act on.
- Build a disciplined fixture and regression corpus so rule changes stay safe to ship.
- Keep the project small, understandable, and easy for contributors to extend.

### Secondary goals

- Improve release confidence and package hygiene.
- Make the docs good enough that first-time users understand scope in under five minutes.
- Create clear extension seams for future rule growth and output evolution.

## Non-Goals

The following are explicitly out of scope unless the product direction changes later:

- executing target code in a sandbox
- private repository authentication flows
- a hosted SaaS service or web dashboard
- a generic vulnerability database or dependency CVE scanner
- “AI trust scores” or opaque composite scoring
- broad multi-language expansion before the JavaScript/TypeScript path is mature

## Target Users

### 1. Individual evaluator

Someone reviewing an unfamiliar MCP server before local use.

Needs:

- quick installation or zero-install usage
- evidence-backed findings
- clear “what this does and does not mean” framing

### 2. Repository maintainer

Someone adding TrustMCP to CI for their own MCP server repository.

Needs:

- stable exit behavior
- readable summaries
- baseline adoption path for existing findings
- machine-readable outputs for workflow branching

### 3. Platform or security owner

Someone evaluating many MCP repositories or enforcing a lightweight review policy.

Needs:

- deterministic outputs
- rule inventory visibility
- artifact-friendly JSON/SARIF
- low-noise operation and reproducible behavior

## Long-Term Workstreams

## 1. Detection Surface Expansion

TrustMCP needs broader coverage, but only in areas that still fit the core capability-review promise.

### Must-add rule families

- dynamic code execution:
  - `eval(...)`
  - `new Function(...)`
  - dynamic module loading paths driven by tool input
- high-risk process launch variants:
  - package-manager command wrappers
  - script runners that hide shell execution behind helpers
- sensitive local data access:
  - home-directory credential paths
  - SSH, cloud, and token-bearing config locations
- archive or download-to-execute patterns:
  - fetch + write + execute chains
- overly broad file mutation:
  - recursive delete/copy/write paths tied to user-controlled inputs

### Should-add rule families

- environment variable exposure patterns
- local server or port-binding behavior that increases reachable surface
- subprocess/network combinations that imply outbound exfiltration workflows
- risky MCP tool descriptions or metadata patterns when clearly grounded in code evidence

### Acceptance standard for every new rule

- clear public rule intent
- deterministic fixtures
- at least one positive test and one non-match regression
- evidence string that a human can verify quickly
- no dependency on runtime execution

## 2. Result Quality And Finding Contract Hardening

TrustMCP will stall if it finds more things but becomes harder to trust.

### Must-have improvements

- stable JSON schema documentation
- explicit finding fingerprint semantics
- line/span consistency improvements where possible
- clearer confidence assignment rules
- deterministic ordering guarantees across all outputs
- documented compatibility policy for machine-readable fields

### Should-have improvements

- structured metadata describing why confidence was assigned
- per-rule remediation style consistency
- explicit suppression rationale fields for future workflows

### Product rule

Do not add new machine-readable fields casually. Once external workflows consume them, they become a public contract.

## 3. Workflow And CI Ergonomics

TrustMCP should become easier to adopt in real pipelines without requiring custom glue code.

### Must-have improvements

- complete action output contract for common workflow branching needs
- documented JSON consumption examples
- cleaner baseline lifecycle guidance
- better SARIF parity with the core report model
- more copy-pasteable GitHub Actions examples by job-to-be-done

### Should-have improvements

- first-party PR comment rendering helper or documented pattern
- richer summary-only output for status checks
- explicit “policy mode” examples for maintainers

### Could-have improvements

- pre-commit or local git hook examples
- lightweight shell integration recipes for multi-repo review loops

## 4. Configuration And Policy Model

The current config model is intentionally simple. That is good, but it will need one more level of maturity.

### Must-have improvements

- keep the config format flat and readable
- document precedence rules across CLI flags, config file, and action inputs
- improve baseline and ignore documentation so users understand the tradeoff

### Should-have improvements

- rule-group presets for common review modes
- clearer distinction between “visibility shaping” and “policy gating”

### Anti-goal

Do not turn config into a large policy language. If a feature needs nested logic, it is probably the wrong abstraction for this project.

## 5. Verification, Fixture Coverage, And Contributor Safety

The project will only scale if contributors can change rules without breaking trust.

### Must-have improvements

- expand fixture coverage for each rule family
- create a documented regression corpus strategy
- require tests for every new public behavior
- keep README, rule docs, and examples aligned with shipped behavior

### Should-have improvements

- a lightweight benchmark or sample-repo set for manual release verification
- release checklist steps for representative real-world targets

## 6. Release And Adoption Maturity

The project needs a stronger “maintained tool” posture, not just more features.

### Must-have improvements

- keep changelog discipline current
- ensure versioned docs and examples stay coherent
- preserve install reliability for npm and source users
- maintain stable Node support expectations

### Should-have improvements

- clarify versioning and compatibility promises
- tighten release automation while keeping publish control manual
- add more honest public examples showing both matches and non-matches

## Roadmap

## Completed Phase 1: `v0.2` foundation hardening

Status: implemented on `main` as the current `0.2.0-dev` baseline. Treat this phase as historical context and do not re-plan it as future roadmap work unless a regression appears.

Completed scope:

- expanded the scanner to twelve capability-focused rules across adjacent MCP risk areas
- documented the machine-readable output contract for JSON reports, action outputs, baseline entries, `list-rules --json`, and SARIF projection
- added finding fingerprints and fingerprint-first baseline identity while preserving legacy tuple baseline entries
- improved SARIF parity with TrustMCP finding identity, baseline state, gated/new finding semantics, and rule metadata
- expanded fixtures, regression tests, and docs around baseline, ignore, CI adoption, and release confidence

Remaining release-readiness notes:

- keep consumer-facing `list-rules --json` examples easy to copy into downstream automation
- keep roadmap docs aligned with the shipped twelve-rule surface
- run the full release gate before cutting the final `v0.2.0` public tag

## Phase 2: `v0.3` signal quality and policy ergonomics

Objective: make TrustMCP easier to adopt in more repositories without becoming noisy or ambiguous.

Scope:

- improve finding identity and suppression semantics
- introduce clearer rule metadata and confidence guidance
- document stable downstream consumption patterns
- grow sample corpus for false-positive review

Exit criteria:

- users can baseline or suppress findings with clearer intent
- machine-readable outputs are documented as a durable public contract
- contributor workflow for rule additions is predictable

## Phase 3: `v0.4+` adoption maturity

Objective: make TrustMCP feel operationally mature while staying intentionally narrow.

Scope:

- polish release discipline and ecosystem docs
- improve examples for teams and platform owners
- add optional presets or rule-group ergonomics if still justified
- revisit broader language or input expansion only after JS/TS is clearly solid

Exit criteria:

- project docs explain adoption patterns for individual, maintainer, and platform use cases
- release quality no longer depends on manual repo memory
- future expansion decisions are made from real usage evidence, not feature pressure

## Prioritization Heuristics

Future work should be prioritized using these filters, in order:

1. Does this improve the core trust-review question before first use?
2. Does this strengthen evidence quality or downstream workflow usability?
3. Can this be explained honestly in one paragraph of docs?
4. Does it keep the product narrow and maintainable?

If a proposed feature fails the first or fourth filter, it should usually not be built.

## Success Metrics

TrustMCP is early, so the first metrics should focus on product utility rather than vanity adoption.

### Leading indicators

- number of real workflow examples maintained in-tree
- number of rule families with regression fixtures
- number of stable machine-readable outputs documented and tested
- time for a first-time user to reach a successful scan path

### Lagging indicators

- repeat use in CI on owned or reference repositories
- issue/PR demand for new rules versus bug reports about ambiguity
- number of releases shipped without output contract regressions

## Risks

### Biggest product risks

- adding too many rules too quickly and damaging trust through noise
- drifting into generic SAST language and losing the MCP-specific positioning
- expanding config and suppression semantics until the tool becomes harder to use than the problem it solves
- shipping machine-readable fields without a compatibility mindset

### Biggest engineering risks

- rule logic becoming ad hoc and inconsistent across files
- output contracts drifting without schema or doc discipline
- examples and docs lagging behind behavior

## Decision Rules

When there is a tradeoff, prefer:

- narrower scope over broader claims
- deterministic behavior over clever heuristics
- explicit evidence over inferred scoring
- stable output contracts over short-term convenience
- one more high-quality rule over many low-confidence rules

## Immediate Next Slices

The next meaningful slices should come from this order:

1. Improve consumer-facing `list-rules --json` examples so rule metadata is easier to automate against.
2. Tighten release/reference-target guardrails so release confidence does not depend on maintainer memory.
3. Improve baseline, ignore, or config ergonomics only where real workflow pain already exists.
4. Add another adjacent high-value rule family only when it can ship with fixtures, docs, and confidence metadata in one coherent change.
5. Expand public examples to show more realistic CI consumption patterns.

That sequence keeps TrustMCP aligned with its strongest path: a small, credible, automation-friendly trust review tool for MCP repositories.
