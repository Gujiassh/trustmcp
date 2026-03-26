# Installing TrustMCP today

TrustMCP is published on npm as `trustmcp`. You can use it today via `npm install -g trustmcp`, `npx trustmcp ...`, or a source checkout when you want the local repository in hand.

This page explains what works now, what source-based setup is still good for, and what the package-readiness checks mean now that npm publication is live.

## Use npm when you want the fastest install path

Install globally:

```bash
npm install -g trustmcp
```

Then run:

```bash
trustmcp --version
trustmcp gh:modelcontextprotocol/servers --format text
```

If you do not want a global install, use `npx`:

```bash
npx trustmcp --version
npx trustmcp gh:modelcontextprotocol/servers --format text
```

## Use a source checkout today

Run:

```bash
git clone https://github.com/Gujiassh/trustmcp.git
cd trustmcp
npm install
npm run build
```

If you want the same setup in one local command after cloning, run:

```bash
npm run bootstrap
```

Then run the CLI directly from the built output:

```bash
node dist/cli/main.js ./path-to-target
```

That is still a supported path for contributors and people who want the repository checked out locally.

If you want the short future-looking note about how a packaged install path would differ conceptually, check out [Future install migration note for source users](./future-install-migration.md).

## Use direct `node dist/cli/main.js` when you want the lowest-friction path

After building, you can run TrustMCP without any linking step:

```bash
node dist/cli/main.js gh:modelcontextprotocol/servers --format text
```

Use this when you want the most explicit setup and do not need a global `trustmcp` command.

## Use `npm link` if you want a local command name

If you are going to run TrustMCP repeatedly on the same machine, you can link the local package into your global npm command path:

```bash
npm link
trustmcp ./path-to-target
```

This still uses your local source checkout. It does **not** install TrustMCP from the npm registry.

## What `npm run pack:check` means

`npm run pack:check` is a packaging readiness check. It runs a dry-run `npm pack` validation and verifies that the future tarball contents are deliberate.

It is useful when you want to confirm that:

- the package can be packed successfully
- the tarball includes the intended runtime files
- unrelated files are not leaking into the package

Run:

```bash
npm run pack:check
```

## What `npm run pack:check` does not mean

`npm run pack:check` does **not** mean:

- you can install it today with `npm install trustmcp`
- a release has been pushed to the registry

It means the repository has a repeatable local check for package contents, independent of whether you are publishing a new version right now.

If you want a stronger local signal before any future publication work, run:

```bash
npm run pack:smoke
```

That command packs the repository, installs the tarball into a temporary directory, and verifies the installed CLI can print its version.

If you are preparing for the eventual manual registry step, check out the [npm publish checklist for TrustMCP](./npm-publish-checklist.md).

## Choose the path that matches what you need

Use:

- direct `node dist/cli/main.js ...` when you want the most explicit local path
- `npm link` when you want a convenient local command name
- `npm run pack:check` when you want to verify future npm tarball readiness without publishing
- `npm run pack:smoke` when you want a stronger tarball installability check before any future publication work

If you are unsure whether your target or config is valid before running a real scan, check out [TrustMCP troubleshooting](./troubleshooting.md) and use the `doctor` command.
