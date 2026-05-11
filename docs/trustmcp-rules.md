# TrustMCP rules explained

TrustMCP currently ships twelve rules for JavaScript and TypeScript MCP server repositories: `mcp/shell-exec`, `mcp/outbound-fetch`, `mcp/broad-filesystem`, `mcp/archive-extract`, `mcp/download-write-exec`, `mcp/dynamic-code-exec`, `mcp/env-secret-exposure`, `mcp/subprocess-network-exfil`, `mcp/tool-metadata-risk`, `mcp/script-runner-exec`, `mcp/sensitive-local-data`, and `mcp/local-service-binding`.

This page explains what each rule is trying to catch, what evidence usually causes a match, and what the rule is **not** claiming.

If you want the current rule IDs from the CLI, run:

```bash
node dist/cli/main.js list-rules
```

If you want machine-readable rule metadata instead of prose, run:

```bash
node dist/cli/main.js list-rules --json
```

That JSON now exposes each rule's default severity plus any shipped `confidenceLevels`, stable `confidenceReasons`, and optional `confidenceGuidance` descriptions. The per-finding `confidenceReason` field in JSON and SARIF results is expected to stay within those declared rule-level reason codes.

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

This rule is trying to catch filesystem operations that look broad, recursive, destructive, or driven by tool-controlled paths.

### What usually causes a match

TrustMCP looks for filesystem access patterns such as:

- `fs.readdir(...)`, `fs.opendir(...)`, `fs.rm(...)`, `fs.cp(...)`, `createReadStream(...)`, or `createWriteStream(...)`
- recursive delete/copy flows and broad write paths
- imported filesystem helpers used after `fs` imports
- recursive operations like `{ recursive: true }`
- home-directory or root-like path handling
- path arguments that appear to come from request or tool input

Typical matched evidence looks like:

- `fs.readdir(input.path, { recursive: true })`
- `createReadStream(userPath)`
- `fs.rm(targetPath, { recursive: true, force: true })`
- `fs.cp(input.sourcePath, input.targetPath, { recursive: true })`

### What the rule is not claiming

This rule is **not** claiming that all filesystem access is a problem.

Reading a fixed local file inside the repository is different from letting tool input reach broad host paths. The rule is aimed at the latter pattern: broad or tool-controlled access that could expose secrets, recursively delete or overwrite unrelated files, or touch sensitive directories.

## `mcp/dynamic-code-exec`

This rule is trying to catch code paths that turn strings into executable runtime behavior inside the host process.

### What usually causes a match

TrustMCP looks for dynamic execution patterns such as:

- `eval(...)`
- `Function(...)` or `new Function(...)`
- `vm.runInNewContext(...)`
- `vm.runInThisContext(...)`
- `vm.compileFunction(...)`
- similar imported `vm` execution helpers

The confidence increases when the code string appears to come from tool input, request input, or similar user-controlled fields.

Typical matched evidence looks like:

- `return eval(input.expression)`
- `new Function(args.code)`
- `vm.runInNewContext(input.code, {})`

### What the rule is not claiming

This rule is **not** claiming that every dynamic execution helper is automatically exploitable or always reachable.

It is also **not** trying to prove whether the executed string is perfectly constrained elsewhere. The narrower claim is that the repository appears to expose dynamic code execution capability, which materially changes the trust profile of an MCP server before first use.

## `mcp/download-write-exec`

This rule is trying to catch download-to-disk execution chains where remote content is fetched, written locally, and then executed or launched.

### What usually causes a match

TrustMCP looks for one-file chains that combine:

- a network fetch/request
- a local write operation
- an execution or runner step

Typical matched evidence looks like:

- `const response = await fetch(input.url); ... await writeFile("/tmp/tool.sh", script, "utf8"); return execa(input.command);`

### What the rule is not claiming

This rule is **not** claiming that every file download is dangerous by itself.

The narrower claim is that the repository appears to bridge remote content into a local execution path, which is a much stronger trust signal than simple outbound fetch or simple file write alone.

## `mcp/script-runner-exec`

This rule is trying to catch host-side execution paths that are wrapped behind package-manager or script-runner commands instead of direct process APIs.

### What usually causes a match

TrustMCP looks for wrapper execution patterns such as:

- `npm run ...`
- `pnpm run ...`
- `yarn run ...`
- `bun run ...`
- `npx ...`
- `tsx ...`
- `node scripts/...`

The confidence increases when the script or command name appears to come from tool or request input.

Typical matched evidence looks like:

- ``return `npm run ${input.script}`;``
- `npx some-tool`
- `node scripts/build.js`

### What the rule is not claiming

This rule is **not** claiming that every package-manager invocation is automatically dangerous.

The narrower claim is that the repository appears to expose a wrapper path that can still launch host-side code, even if direct `child_process` usage is hidden behind a task runner or helper command.

## `mcp/env-secret-exposure`

This rule is trying to catch code paths that read secret-bearing environment variables and then flow them into a dangerous sink such as a network request, execution path, log line, or tool response.

### What usually causes a match

TrustMCP looks for environment reads like:

- `process.env.GITHUB_TOKEN`
- `process.env.OPENAI_API_KEY`
- `process.env.AWS_SECRET_ACCESS_KEY`
- similar variable names containing `TOKEN`, `SECRET`, `KEY`, `PASSWORD`, `CREDENTIAL`, or `AUTH`

It then requires that the same snippet also shows a sink such as:

- outbound request
- host-side execution
- log output
- direct return path

Typical matched evidence looks like:

- `const token = process.env.GITHUB_TOKEN; return fetch(input.url, { headers: { Authorization: \`Bearer ${token}\` } });`

### What the rule is not claiming

This rule is **not** claiming that every environment variable read is risky.

The narrower claim is that the repository appears to read secret-bearing environment values and expose them into a path that could leak or misuse them, which is a stronger signal than merely accessing environment configuration in general.

## `mcp/tool-metadata-risk`

This rule is trying to catch MCP tool metadata that explicitly advertises high-risk host capabilities before reviewers even inspect the implementation.

### What usually causes a match

TrustMCP looks for `description`, `title`, or `summary` strings that directly advertise capabilities such as:

- executing shell commands
- using the terminal
- running scripts
- reading secrets or credentials
- accessing `.aws` or SSH material
- downloading and running content
- sending results to remote systems

Typical matched evidence looks like:

- `description: "Execute shell commands, read credentials, and send results to a remote endpoint."`

### What the rule is not claiming

This rule is **not** claiming that metadata alone proves the implementation definitely does the dangerous thing.

The narrower claim is that the repository is explicitly advertising high-risk capability in tool metadata, which is itself a strong trust-review signal and should line up with deliberate review and gating expectations.

## `mcp/sensitive-local-data`

This rule is trying to catch direct access to local credential- or secret-bearing paths.

### What usually causes a match

TrustMCP looks for filesystem reads or writes that touch paths such as:

- `~/.ssh/...`
- `~/.aws/credentials`
- `.npmrc`
- `.pypirc`
- `.env`
- `id_rsa`, `id_ed25519`
- service-account or credential JSON files
- other obvious token/secret-bearing path names

The confidence increases when the path appears to come from tool or request input.

Typical matched evidence looks like:

- `fs.readFile(`${process.env.HOME}/.aws/credentials`, "utf8")`
- `fs.readFile(input.secretPath, "utf8")`

### What the rule is not claiming

This rule is **not** claiming that every read of a local config file is definitely malicious.

The narrower claim is that the repository appears able to touch local secret-bearing paths, which is a materially different trust signal from generic filesystem access because it narrows in on credential and token exposure surfaces directly.

## `mcp/archive-extract`

This rule is trying to catch archive unpacking capability that can expand untrusted file trees onto the host.

### What usually causes a match

TrustMCP looks for archive extraction helpers such as:

- `AdmZip(...)`
- `extractAllTo(...)`
- `unzip(...)`
- `tar.extract(...)` / `tar.x(...)`
- similar generic archive decompression helpers

The confidence increases when the archive path or extraction target appears to come from tool or request input.

Typical matched evidence looks like:

- `const archive = new AdmZip(input.archivePath); archive.extractAllTo(input.targetPath, true);`

### What the rule is not claiming

This rule is **not** claiming that every archive extraction is automatically dangerous.

The narrower claim is that the repository appears able to unpack archive content onto the host, which can combine with path traversal, overwrite, or later execution flows in ways worth reviewing before local use.

### Relationship to `mcp/broad-filesystem`

This rule is intentionally allowed to overlap with `mcp/broad-filesystem`.

If a repository reads something like `~/.aws/credentials`, TrustMCP may report both:

- `mcp/broad-filesystem`
- `mcp/sensitive-local-data`

That is not treated as a duplicate bug in the current model:

- `mcp/broad-filesystem` says the repository can reach broad or high-risk local paths
- `mcp/sensitive-local-data` says the accessed path is specifically secret- or credential-bearing

Those are related but distinct trust-review signals.

## `mcp/local-service-binding`

This rule is trying to catch code paths that open local listeners or bind ports from inside the MCP server process.

### What usually causes a match

TrustMCP looks for service-binding patterns such as:

- `app.listen(...)`, `server.listen(...)`, or similar listener startup calls
- `createServer(...).listen(...)` chains
- bind addresses like `0.0.0.0`, `::`, or `[::]`
- host or port values that appear to come from tool, request, or argument input

Typical matched evidence looks like:

- `return app.listen(input.port, "0.0.0.0")`
- `server.listen(args.port)`

### What the rule is not claiming

This rule is **not** claiming that every local listener is automatically unsafe.

The narrower claim is that the repository appears able to expand its reachable surface by opening a listener or binding a service address, which can matter even when there is no direct outbound fetch or shell execution path.

## `mcp/subprocess-network-exfil`

This rule is trying to catch same-file flows that combine host-side command execution with outbound network delivery.

### What usually causes a match

TrustMCP looks for files that contain both:

- a subprocess execution path
- an outbound request path

The confidence increases when the command, URL, output, or payload is controlled by tool or request input.

Typical matched evidence looks like:

- `const result = await execa(input.command); return fetch(input.url, { method: "POST", body: result.stdout });`

### What the rule is not claiming

This rule is **not** claiming that every repository with both subprocess and network code is definitely exfiltrating data.

The narrower claim is that the repository appears to contain a direct capability chain where local command execution and remote delivery coexist in one flow, which is a materially stronger trust signal than either capability alone.

## Why these rules are narrow on purpose

TrustMCP is not trying to be a full security review in one command. These rules are intentionally capability-focused and evidence-based.

They answer questions like:

- does this repository appear able to execute commands?
- does it appear able to make outbound requests?
- does it appear able to reach broad or tool-controlled filesystem paths?
- does it appear able to unpack archive content onto the host?
- does it appear able to execute dynamic code strings at runtime?
- does it appear able to expose secret-bearing environment variables into requests, execution, logs, or responses?
- does it explicitly advertise high-risk host capability in MCP tool metadata?
- does it appear able to trigger host-side code through script or package-manager wrappers?
- does it appear able to fetch remote content, write it locally, and then execute it?
- does it appear able to touch local credential or secret-bearing paths?
- does it appear able to open local listeners or bind public service addresses?

They do **not** answer every security question about an MCP server, and they do **not** prove a repository is safe when no rules match.

If you want the broader scope explanation, check out [What TrustMCP scans, and how it differs from npm audit](./what-trustmcp-scans.md).
