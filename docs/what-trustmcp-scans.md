# What TrustMCP scans, and how it differs from npm audit

TrustMCP scans JavaScript and TypeScript MCP server repositories for a small set of risky capabilities in source code. It is **not** a dependency vulnerability scanner, and it does **not** execute the target.

If you found TrustMCP by searching for "what does this scan?" or comparing it to `npm audit`, the short answer is:

- TrustMCP scans repository code for risky MCP server capabilities.
- `npm audit` scans dependency metadata for known published vulnerabilities.

They solve different problems.

## What TrustMCP scans today

TrustMCP v0.1 ships three static rules:

- `mcp/shell-exec`
- `mcp/outbound-fetch`
- `mcp/broad-filesystem`

In practice, that means TrustMCP looks for source patterns that suggest an MCP server can:

- execute shell commands on the host
- make outbound network requests
- access broad or tool-controlled filesystem paths

Every finding includes a rule ID, severity, confidence, file, line when available, evidence, why it matters, and a remediation note.

To see the currently shipped rule set from the CLI, run:

```bash
node dist/cli/main.js list-rules
```

## What TrustMCP does not scan

TrustMCP is intentionally narrow. It does **not**:

- scan npm packages for CVEs or dependency advisories
- execute untrusted code in a sandbox
- prove a repository is safe when no rules match
- cover every MCP risk or every JavaScript security issue
- inspect private repositories, auth flows, or hosted services

When TrustMCP says `No matching rules were triggered.`, that means the current rules did not match the current repository snapshot. It is not a safety verdict.

## How this differs from npm audit

`npm audit` asks a dependency question:

- do the packages in your dependency tree match known published vulnerabilities?

TrustMCP asks a repository capability question:

- does this MCP server source code appear able to execute commands, call out to the network, or reach broad filesystem paths?

That difference matters because an MCP server can be risky even when its dependency tree is clean.

For example:

- a repository may have **no known vulnerable dependencies**, but still expose `exec(...)` to tool input
- a repository may pass `npm audit`, but still let prompts trigger network fetches or broad file reads

TrustMCP is meant to complement dependency scanning, not replace it.

## What capability scanning is good for

TrustMCP is useful when you want a fast first pass on a repository before deeper review, especially when the question is:

- "What can this MCP server do on my machine?"
- "Does this code appear able to execute commands or touch broad paths?"
- "Should I take a closer look before wiring this into local tools or CI?"

That is why the output focuses on concrete evidence and capability descriptions, rather than broad trust scores.

## What a realistic workflow looks like

A practical flow is:

1. run TrustMCP on a local folder or public GitHub repo
2. inspect any matched capability findings
3. decide whether the repository needs manual review, tighter sandboxing, or narrower operational use
4. use other tools separately for dependency advisories, secret scanning, or runtime isolation

## Scope and non-goals

TrustMCP is a static heuristic scanner for MCP server repositories. Its non-goals are part of the design:

- no hosted platform
- no runtime execution engine
- no "AI-powered" black box scoring
- no claim of complete security coverage

That narrow scope is deliberate. The goal is to make risky capability review faster and more concrete, not to promise a full security assessment.
