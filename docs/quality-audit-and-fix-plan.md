# TrustMCP Quality Audit And Delegated Fix Plan

Status: implemented and released as `v0.2.0`

Reviewed revision: `v0.2.0` release baseline on 2026-07-13

Purpose: record the verified correctness, coverage, input-safety, and release gaps, their semantic oracles, and the implementation outcome.

## Implementation Result

TM-QA-001 through TM-QA-008 are implemented and released in `0.2.0`:

- filesystem import parity is parser-backed across `fs`, `node:fs`, `fs/promises`, and `node:fs/promises`
- high-risk call rules ignore comments and unrelated strings
- download/write/execute and subprocess/network findings require same-scope order and shallow value relationships
- environment-secret findings require direct or one-hop source-to-sink flow
- source collection reports oversized, binary, and symbolic-link files through the public `coverage` contract
- public GitHub archives are rejected before extraction when entry, uncompressed-size, or path budgets are exceeded
- focused regression suites cover the verified positive and negative cases

Repository metadata, the npm package, the GitHub release, and the reusable Action tag are aligned at `0.2.0`. TM-QA-007 is complete.

Verification completed on 2026-07-13:

- `npm test`: 18 files, 222 tests passed
- `npm run build`
- `npm run smoke`
- `npm run pack:check`: 95 packed files validated
- `npm run pack:smoke`: local tarball install reported `trustmcp@0.2.0`
- `npm run reference:check`
- `npm run release:check`
- `npm run release:check:strict`: all three live reference categories passed
- `npm audit --omit=dev --audit-level=moderate --registry=https://registry.npmjs.org`: 0 vulnerabilities
- `git diff --check`

## Scope

This plan covers:

- false negatives in supported JavaScript and TypeScript source patterns
- false positives caused by file-wide and raw-text matching
- incomplete scan coverage that is currently silent
- resource bounds for public GitHub archive materialization
- the gap between the repository's `0.2.0-dev` surface and npm `latest`
- focused regression and release verification

This plan does not cover:

- a Rust rewrite
- a hosted service or web UI
- private repository authentication
- runtime sandboxing
- expansion into a general-purpose SAST product
- new rule families before the current rules become more trustworthy

## Verified Baseline

The following checks passed on the reviewed revision:

- `npm test`: 15 files, 187 tests passed
- `npm run build`
- `npm run pack:check`
- `npm run pack:smoke`
- `npm run reference:check`
- `npm run release:check`
- `npm run smoke`
- `npm audit --omit=dev --audit-level=moderate --registry=https://registry.npmjs.org`: 0 vulnerabilities

The worktree was clean and matched `origin/main` when this audit was performed.

## Semantic Oracles

Every implementation should preserve these invariants:

1. A finding must be backed by executable JavaScript or TypeScript syntax, not a comment or an unrelated string literal.
2. A chain finding must represent one executable flow. Capability calls in unrelated functions must not be combined into a chain.
3. Common supported Node.js import forms must produce the same result, including `node:fs/promises` and `fs/promises`.
4. A no-match result must never hide incomplete source coverage. Skipped relevant files must be visible in human and machine-readable output.
5. Public repository scanning must keep compressed and uncompressed archive work within explicit limits.
6. Existing finding identity, baseline behavior, exit-code semantics, and renderer determinism must remain stable unless an approved contract change is documented and tested.
7. Separate capability findings such as shell execution or outbound network access may remain even when a higher-order chain finding is not justified.

## Findings And Fix Plans

### TM-QA-001: `fs/promises` imports bypass filesystem rules

Priority: P1

Type: false negative

Affected code:

- `src/rules/broad-filesystem.ts`
- `src/rules/sensitive-local-data.ts`

Verified reproduction:

```ts
import { readFile } from "node:fs/promises";

export function read(input: { path: string }) {
  return readFile(input.path, "utf8");
}
```

The current scanner reports zero findings. The same result occurs with `fs/promises`.

Root cause:

- `FS_IMPORT_PATTERN` recognizes only `node:fs` and `fs`.
- Bare imported calls are evaluated only when that import pattern is present.

Recommended fix:

1. Extend immediate import coverage to `node:fs/promises` and `fs/promises`.
2. Resolve imported local names, including aliases such as `readFile as read`, through the parser-backed source analysis described in TM-QA-004.
3. Keep qualified forms such as `fs.promises.readFile(...)` working.
4. Share one filesystem import/call classifier between the broad-filesystem and sensitive-local-data rules instead of duplicating regexes.

Required tests:

- positive: `node:fs/promises` named import
- positive: `fs/promises` named import
- positive: aliased import
- positive: namespace import
- negative: an unrelated local function named `readFile`
- parity: the same call shape produces equivalent findings across supported import forms

Acceptance criteria:

- both reproduction inputs trigger `mcp/broad-filesystem`
- a sensitive credential path also triggers `mcp/sensitive-local-data`
- unrelated local functions do not trigger either rule
- line numbers and evidence remain deterministic

### TM-QA-002: relevant source files can be skipped silently

Priority: P1

Type: false negative and incomplete coverage reporting

Affected code:

- `src/core/source-files.ts`
- `src/core/types.ts`
- `src/core/audit.ts`
- `src/renderers/*`
- `src/action/main.ts`

Verified reproduction:

- create a JavaScript or TypeScript file larger than 256,000 bytes
- place an executable `eval(...)` call in that file
- scan the containing directory

The current collector omits the file at `MAX_FILE_BYTES` and the final report does not say that coverage was incomplete.

Root cause:

- files above `MAX_FILE_BYTES` are skipped with `continue`
- the collector returns only included files and discards skip metadata
- report and renderer contracts have no coverage section

Recommended fix:

1. Change collection to return both scanned files and skipped-file records.
2. Record at least `relativePath`, `reason`, and observed byte size for each skipped relevant file.
3. Keep a bounded file-size policy; do not remove all limits.
4. Add an additive `coverage` block to `AuditReport`, including scanned-file count, skipped-file count, and `complete`.
5. Surface incomplete coverage in text, Markdown, JSON, SARIF properties, summary-only output, and the GitHub Action step summary.
6. Change the no-match message when relevant files were skipped. It must say that no rules matched in the scanned subset and that coverage was incomplete.
7. Document the size limit and ignored-directory policy explicitly.

Contract note:

Adding `coverage` changes the public report contract. Update `docs/machine-readable-output-contract.md`, renderer snapshots, Action tests, README examples, and the changelog in the same change.

Required tests:

- a normal source file is collected
- an oversized relevant source file is recorded as skipped
- binary files are recorded or excluded with an explicit documented reason
- symlinks remain safely excluded and are represented consistently
- a no-match report with skipped files warns about incomplete coverage
- JSON and SARIF expose deterministic coverage metadata
- existing complete scans retain their current finding and exit-code behavior

Acceptance criteria:

- no relevant source file disappears without reportable metadata
- a user can distinguish `complete no-match` from `incomplete no-match`
- limits prevent unbounded memory use

### TM-QA-003: chain rules combine unrelated functions

Priority: P1

Type: high-severity false positive

Affected code:

- `src/rules/download-write-exec.ts`
- `src/rules/subprocess-network-exfil.ts`

Verified reproduction:

```ts
export function ping() {
  return fetch("https://example.com");
}

export function save() {
  return writeFile("/tmp/cache", "x");
}

export function run() {
  return execa("git", ["status"]);
}
```

The current scanner reports both `mcp/download-write-exec` and `mcp/subprocess-network-exfil`, even though there is no data flow or execution chain between the functions.

Root cause:

- the rules check only whether capability patterns occur anywhere in the same file
- call order, function scope, identifiers, arguments, and returned values are not connected

Recommended fix:

1. Use parser-backed call facts grouped by the nearest function or module scope.
2. For `download-write-exec`, require network, write, and execution stages in one scope and in executable order.
3. Require a shallow data relationship before calling the result a chain. Examples include downloaded content written to a path that is later executed, or a written artifact path passed to an execution call.
4. For `subprocess-network-exfil`, require subprocess output or a derived identifier to reach a network request body, headers, query, or destination in the same scope.
5. Do not replace the current behavior with an arbitrary line-distance heuristic.
6. Preserve independent shell, network, and filesystem capability findings when the chain rule does not match.

Required tests:

- positive: true download to write to execute flow
- positive: subprocess output reaches a request body
- negative: unrelated functions in one file
- negative: same function with unrelated values
- negative: reverse call order without flow
- negative: capability calls split across files
- negative: comments and string examples containing all keywords

Acceptance criteria:

- the verified reproduction emits no chain findings
- existing true-positive fixtures still emit the intended chain findings
- evidence identifies the relevant connected operations
- confidence reflects the strength of the data relationship

### TM-QA-004: raw-text matching treats comments and strings as executable code

Priority: P1

Type: false positive and shared rule-engine weakness

Affected code:

- `src/rules/dynamic-code-exec.ts`
- other rules that scan `file.lines` with raw regular expressions
- new parser-backed analysis module under `src/analysis/`

Verified reproduction:

```ts
// eval("untrusted")
```

The current scanner reports `mcp/dynamic-code-exec` at high severity with medium confidence.

Recommended fix:

1. Add a small parser-backed source-analysis layer using the TypeScript compiler API for JavaScript, TypeScript, JSX, and TSX.
2. Match executable call expressions, imports, member expressions, identifiers, and literal arguments from syntax nodes.
3. Preserve source offsets so findings keep accurate lines and human-readable evidence.
4. Migrate the highest-risk rules first: dynamic-code-exec, shell-exec, broad-filesystem, sensitive-local-data, and both chain rules.
5. Continue using literal values where they are semantically relevant, such as URL and credential-path arguments, but never match arbitrary comments or unrelated strings.

Packaging decision:

The TypeScript compiler is currently a development dependency. A runtime parser requires either:

- moving `typescript` to runtime dependencies, or
- bundling the parser and scanner into a shipped artifact

The recommended first implementation is to make the parser dependency explicit, measure the packed and installed size, and keep correctness ahead of a hand-written tokenizer. Do not implement brace matching or comment stripping as the primary parser.

Required tests:

- negative: line and block comments
- negative: documentation strings containing `eval(`, `fetch(`, or `exec(`
- positive: direct `eval(...)`
- positive: `new Function(...)`
- positive: aliased and namespace imports where supported
- line-number parity after parser migration

Acceptance criteria:

- the verified comment reproduction emits no finding
- executable dynamic-code calls still trigger
- parser failures produce an explicit coverage/error signal rather than silently falling back to misleading raw-text findings

### TM-QA-005: environment-secret exposure uses adjacency instead of data flow

Priority: P1

Type: high-confidence false positive and false-negative risk

Affected code:

- `src/rules/env-secret-exposure.ts`

Verified reproduction:

```ts
export function version() {
  const token = process.env.API_TOKEN;
  return "1.0.0";
}
```

The current scanner reports `mcp/env-secret-exposure` with high confidence even though the secret identifier is not returned or sent anywhere.

Root cause:

- the rule inspects a fixed two-line snippet after the environment read
- `return` is treated as a dangerous sink without checking the returned expression
- identifiers are not tracked from source to sink

Recommended fix:

1. Use function-scoped shallow taint facts from the parser-backed analysis layer.
2. Treat secret-bearing environment reads as sources.
3. Track direct assignments and simple identifier propagation within the same function.
4. Match only when the source or a tracked identifier is present in a network, execution, logging, or returned expression.
5. Keep the analysis intentionally shallow and document that it is not interprocedural taint analysis.
6. Support dot and bracket environment access where practical, including `process.env.API_TOKEN` and `process.env["API_TOKEN"]`.

Required tests:

- negative: unused secret followed by an unrelated return
- negative: secret used only in a local comparison
- positive: direct return of a secret
- positive: assigned identifier sent in a request header or body
- positive: secret passed to logging or process execution
- positive: bracket notation
- negative: non-secret variables such as `NODE_ENV`

Acceptance criteria:

- the verified reproduction emits no finding
- direct and one-hop secret flows still trigger
- confidence reasons remain stable or are versioned and documented if renamed

### TM-QA-006: GitHub archive extraction lacks uncompressed resource limits

Priority: P2

Type: scanner availability and resource-safety risk

Affected code:

- `src/inputs/github.ts`

Current behavior:

- HTTP response bytes are capped at 25 MB
- the archive is then extracted in full with `AdmZip.extractAllTo(...)`
- there is no explicit entry-count, per-entry uncompressed-size, or total uncompressed-size budget

Impact:

A highly compressible or unusually large public repository archive can consume excessive memory, disk, or execution time before source-file limits are applied.

Recommended fix:

1. Extract archive validation into a testable helper.
2. Inspect archive entries before extraction.
3. Enforce centrally named limits for entry count, per-entry uncompressed bytes, and total uncompressed bytes.
4. Reject archives that exceed a limit with an actionable error that names the exceeded budget.
5. Validate that every canonical destination stays inside the temporary root even though the dependency already sanitizes paths.
6. Keep cleanup in all failure paths.
7. Document the public-repository size boundary.

Required tests:

- normal GitHub-shaped archive extracts successfully
- too many entries are rejected
- excessive total uncompressed size is rejected before extraction
- path traversal entries are rejected
- temporary directories are cleaned after validation and extraction failures

Acceptance criteria:

- extraction work is bounded before file data is written
- errors distinguish network-size and uncompressed-size failures
- normal reference targets remain scannable

### TM-QA-007: publish the latest implemented scanner as npm `latest`

Priority: P2

Type: release and adoption gap

Resolved state on 2026-07-13:

- repository version: `0.2.0`
- npm `latest`: `0.2.0`
- GitHub release and reusable Action tag: `v0.2.0`
- npm users receive the current thirteen-rule scanner surface

Completed release procedure:

1. Update `package.json`, `package-lock.json`, `src/core/version.ts`, changelog, README, and release docs to final `0.2.0` values.
2. Run the full release gate below.
3. Create the `v0.2.0` GitHub release from the default branch.
4. Publish `trustmcp@0.2.0` to npm manually.
5. Replace `@main` in official Action examples with the supported release tag policy.
6. Verify registry metadata and the installed CLI after publication.

Release acceptance criteria:

- `npm view trustmcp version --registry=https://registry.npmjs.org` prints `0.2.0`
- `npx trustmcp@0.2.0 list-rules --json` exposes the expected rule set
- the GitHub release tag and npm package point to the same source revision
- the packed CLI, Action examples, README, and changelog describe the same behavior

External-action note:

GitHub release creation and npm publication were performed only after explicit maintainer authorization.

### TM-QA-008: regression coverage does not exercise source collection and adversarial boundaries directly

Priority: P2

Type: test gap

Current state:

- the existing 187 tests cover CLI, Action, renderers, aggregate fixtures, and rule examples well
- there is no focused source-file collector suite for size, symlink, binary, and ignored-path behavior
- existing rule tests emphasize positive examples more than adversarial non-match cases
- `npm run build` is the type gate; there is no separate lint or coverage command

Recommended fix:

1. Add `tests/source-files.test.ts` for collection boundaries.
2. Add `tests/rule-regressions.test.ts` for the verified false-positive and false-negative cases in this document.
3. Add `tests/github-archive.test.ts` for bounded extraction.
4. Keep aggregate fixture counts, but do not use aggregate counts as the only correctness oracle.
5. Add a coverage command only if it is used as an engineering signal. Do not introduce an arbitrary percentage gate without a reviewed baseline.
6. Add linting only if a concrete rule set is agreed; TypeScript build remains the required unresolved-identifier/type gate.

Acceptance criteria:

- each issue in this document has at least one failing-before and passing-after regression test
- negative tests prove that unrelated code does not trigger high-severity findings
- tests assert business semantics, not implementation details alone

## Recommended Implementation Sequence

### Phase 1: immediate false-negative and safety fixes

- TM-QA-001: complete filesystem import coverage
- TM-QA-006: bound archive extraction
- add their focused tests

These changes can proceed independently if they do not edit the same test files.

### Phase 2: parser-backed rule analysis

- establish the shared parser-backed analysis layer
- TM-QA-004: stop raw comment/string matches
- TM-QA-003: make chain findings function- and flow-aware
- TM-QA-005: add shallow secret source-to-sink tracking

Assign one implementation owner to this phase. These rules share the same analysis model and should not be implemented by independent workers with incompatible abstractions.

### Phase 3: coverage contract

- TM-QA-002: add skipped-file accounting and coverage output
- update all renderers, Action outputs where applicable, machine-readable contract docs, and snapshots

This phase changes public report structure and needs dedicated contract review.

### Phase 4: release readiness

- TM-QA-008: complete adversarial regression coverage
- update public docs and changelog
- run full verification
- TM-QA-007: prepare and publish `0.2.0` only after approval

## Suggested Ownership Lanes

To avoid overlapping edits:

- Lane A, source analysis: `src/analysis/**`, affected rules, `tests/rule-regressions.test.ts`
- Lane B, collection and coverage: `src/core/source-files.ts`, report types/audit/renderers, `tests/source-files.test.ts`
- Lane C, GitHub archive safety: `src/inputs/github.ts`, `tests/github-archive.test.ts`
- Lane D, release and docs: package metadata, workflows, README, changelog, contract docs after Lanes A-C merge
- Lane E, independent review: semantic-oracle review, adversarial fixtures, full release verification

If existing files such as `tests/audit.test.ts` or `tests/renderers.test.ts` need changes from multiple lanes, serialize those edits through the integrator.

## Full Verification Gate

Run from the repository root:

```bash
npm test
npm run build
npm run smoke
npm run pack:check
npm run pack:smoke
npm run reference:check
npm run release:check
npm audit --omit=dev --audit-level=moderate --registry=https://registry.npmjs.org
git diff --check
```

Before a scanner-behavior release, also run the network-dependent gate when GitHub access is available:

```bash
npm run release:check:strict
```

The release is not ready if any of these are true:

- a verified reproduction from this document still fails its acceptance criteria
- a no-match report can hide skipped relevant source files
- chain findings still rely only on file-wide co-occurrence
- comments or unrelated strings still produce executable-code findings
- archive extraction remains unbounded
- npm, GitHub release, README, Action examples, and CLI versions disagree

## Post-Release Maintenance Boundary

After `0.2.0`, keep TrustMCP in focused maintenance mode until real usage supplies new evidence. Prioritize correctness fixes, reference-target drift, dependency updates, and direct user reports. Do not add new rule families solely to increase rule count.
