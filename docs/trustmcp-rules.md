# TrustMCP rules explained

TrustMCP currently ships three rules for JavaScript and TypeScript MCP server repositories: `mcp/shell-exec`, `mcp/outbound-fetch`, and `mcp/broad-filesystem`.

This page explains what each rule is trying to catch, what evidence usually causes a match, and what the rule is **not** claiming.

If you want the current rule IDs from the CLI, run:

```bash
node dist/cli/main.js list-rules
```

## `mcp/shell-exec`

This rule is trying to catch code paths that can execute host commands.

### What usually causes a match

TrustMCP looks for direct shell and process-launch patterns such as:

- Node.js `child_process` calls like `exec(...)`, `execSync(...)`, `spawn(...)`, or `fork(...)`
- imported child-process helpers used directly after `child_process` imports
- common wrappers like `execa(...)`
- Bun process launch calls like `Bun.spawn(...)`

Typical matched evidence looks like:

- `exec(args.command)`
- `child_process.spawn(command, args)`
- `execa(userInput)`

### What the rule is not claiming

This rule is **not** claiming that every shell call is automatically exploitable or unsafe in context.

It is also **not** claiming to prove whether input is safely constrained later. It flags that the repository appears to expose command execution capability, which is exactly the kind of thing people usually want to review before running an unknown MCP server locally.

## `mcp/outbound-fetch`

This rule is trying to catch code paths that can send data from the MCP server to another network destination.

### What usually causes a match

TrustMCP looks for outbound HTTP request patterns such as:

- `fetch(...)`
- `axios(...)` and common axios verb helpers
- `http.request(...)` or `https.get(...)`
- `got(...)`
- `undici.request(...)` or `undici.fetch(...)`

The confidence increases when the code suggests that the destination URL comes from tool input or request data.

Typical matched evidence looks like:

- `return fetch(input.url)`
- `axios.post(args.webhookUrl, payload)`
- `https.request(request.url, ...)`

### What the rule is not claiming

This rule is **not** claiming that every outbound request is malicious or that every network-capable MCP server is unacceptable.

It is also **not** trying to classify remote destinations as safe or unsafe. The point is narrower: if a repository appears able to make outbound requests, that capability matters because prompts, tokens, or local data can leave the machine.

## `mcp/broad-filesystem`

This rule is trying to catch filesystem operations that look broad, recursive, or driven by tool-controlled paths.

### What usually causes a match

TrustMCP looks for filesystem access patterns such as:

- `fs.readdir(...)`, `fs.opendir(...)`, `fs.rm(...)`, `fs.cp(...)`, `createReadStream(...)`, or `createWriteStream(...)`
- imported filesystem helpers used after `fs` imports
- recursive operations like `{ recursive: true }`
- home-directory or root-like path handling
- path arguments that appear to come from request or tool input

Typical matched evidence looks like:

- `fs.readdir(input.path, { recursive: true })`
- `createReadStream(userPath)`
- `fs.rm(targetPath, { recursive: true, force: true })`

### What the rule is not claiming

This rule is **not** claiming that all filesystem access is a problem.

Reading a fixed local file inside the repository is different from letting tool input reach broad host paths. The rule is aimed at the latter pattern: broad or tool-controlled access that could expose secrets, modify unrelated files, or touch sensitive directories.

## Why these rules are narrow on purpose

TrustMCP is not trying to be a full security review in one command. These rules are intentionally capability-focused and evidence-based.

They answer questions like:

- does this repository appear able to execute commands?
- does it appear able to make outbound requests?
- does it appear able to reach broad or tool-controlled filesystem paths?

They do **not** answer every security question about an MCP server, and they do **not** prove a repository is safe when no rules match.

If you want the broader scope explanation, check out [What TrustMCP scans, and how it differs from npm audit](./what-trustmcp-scans.md).
