# npm publish checklist for TrustMCP

Use this checklist when TrustMCP is actually ready to cross from pack-ready to published on npm.

This page is intentionally narrow. It does **not** publish anything for you, and it does **not** mean TrustMCP is already available on npm today.

## Run this checklist before the final manual publish step

- [ ] `package.json` has the exact version you intend to publish
- [ ] the repository is no longer on a development suffix such as `0.2.0-dev`
- [ ] `CHANGELOG.md` has a matching release entry or release notes are ready
- [ ] `npm run release:check` passes locally
- [ ] the manual GitHub release workflow is ready to run from the default branch
- [ ] you are logged in to the correct npm account for the target package namespace
- [ ] you have confirmed the package name and access level you intend to publish

## What `npm run release:check` covers

Run:

```bash
npm run release:check
```

That command validates the full local release gate without publishing:

- `reference:check` passes for the checked-in reference-target manifest
- packaging-oriented local checks still pass through `publish:check`

Use [the release gate chooser](./release-confidence-and-reference-targets.md#release-gate-chooser) before deciding whether this is enough for the slice. `release:check` does not replay live public reference-target scans; use `release:check:strict` when the release claims strict reference-target confidence.

If you only need the packaging-oriented subset, run:

```bash
npm run publish:check
```

That narrower command validates:

- tests pass
- the TypeScript build succeeds
- `npm pack --dry-run` succeeds through the repo's pack validation path
- `npm run pack:smoke` still installs and starts the tarball

If you want the strictest local pre-release gate, including current public reference-target scans, run:

```bash
npm run release:check:strict
```

## What this checklist does not mean

This checklist does **not** mean:

- TrustMCP is already published
- a GitHub release has already been created
- npm publication is automatic

It is only a final manual preflight for the moment when maintainers decide the package is ready for registry publication.

## Keep the order explicit

The current lightweight release path is:

1. update `package.json` and `CHANGELOG.md`
2. choose the right gate from the release gate chooser, then run at least `npm run release:check`
3. use `npm run release:check:strict` when release notes or public examples claim current live reference-target confidence
4. create the GitHub release through the manual workflow
5. make sure npm login, package name, and publish intent are correct
6. run the final manual npm publish step when the project is ready

If you only need local or source-based usage today, check out [Installing TrustMCP today](./installing-trustmcp.md).
