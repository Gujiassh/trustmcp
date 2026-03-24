# Installing TrustMCP today

TrustMCP is not published to npm yet. The supported installation path today is source checkout, local build, and then either direct `node` usage or optional local linking.

This page explains what works now, what `npm link` is for, and what `npm run pack:check` means without implying that the package is already available on npm.

## Use a source checkout today

Run:

```bash
git clone https://github.com/Gujiassh/trustmcp.git
cd trustmcp
npm install
npm run build
```

Then run the CLI directly from the built output:

```bash
node dist/cli/main.js ./path-to-target
```

That is the main supported path today.

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

- TrustMCP is already published to npm
- you can install it today with `npm install trustmcp`
- a release has been pushed to the registry

It only means the repository has a repeatable local check for future packaging.

If you are preparing for the eventual manual registry step, check out the [npm publish checklist for TrustMCP](./npm-publish-checklist.md).

## Choose the path that matches what you need

Use:

- direct `node dist/cli/main.js ...` when you want the most explicit local path
- `npm link` when you want a convenient local command name
- `npm run pack:check` when you want to verify future npm tarball readiness without publishing

If you are unsure whether your target or config is valid before running a real scan, check out [TrustMCP troubleshooting](./troubleshooting.md) and use the `doctor` command.
