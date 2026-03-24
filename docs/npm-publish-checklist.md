# npm publish checklist for TrustMCP

Use this checklist when TrustMCP is actually ready to cross from pack-ready to published on npm.

This page is intentionally narrow. It does **not** publish anything for you, and it does **not** mean TrustMCP is already available on npm today.

## Run this checklist before the final manual publish step

- [ ] `package.json` has the exact version you intend to publish
- [ ] `CHANGELOG.md` has a matching release entry or release notes are ready
- [ ] `npm run publish:check` passes locally
- [ ] the manual GitHub release workflow is ready to run from the default branch
- [ ] you are logged in to the correct npm account for the target package namespace
- [ ] you have confirmed the package name and access level you intend to publish

## What `npm run publish:check` covers

Run:

```bash
npm run publish:check
```

That command validates the current local release gates without publishing:

- tests pass
- the TypeScript build succeeds
- `npm pack --dry-run` succeeds through the repo's pack validation path

## What this checklist does not mean

This checklist does **not** mean:

- TrustMCP is already published
- a GitHub release has already been created
- npm publication is automatic

It is only a final manual preflight for the moment when maintainers decide the package is ready for registry publication.

## Keep the order explicit

The current lightweight release path is:

1. update `package.json` and `CHANGELOG.md`
2. run `npm run publish:check`
3. create the GitHub release through the manual workflow
4. make sure npm login, package name, and publish intent are correct
5. run the final manual npm publish step when the project is ready

If you only need local or source-based usage today, check out [Installing TrustMCP today](./installing-trustmcp.md).
