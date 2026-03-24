# Future install migration note for source users

TrustMCP works today from source checkout. That is the real supported path right now.

Today, people use TrustMCP by:

- cloning the repository
- running `npm install`
- running `npm run build`
- using either `node dist/cli/main.js ...` or `npm link`

This page explains how to think about a future packaged install path without implying that npm publication already exists.

## What is real today

TrustMCP is **not published to npm yet**.

The current supported options are:

- direct `node dist/cli/main.js ...` usage from a built source checkout
- optional `npm link` from that same local source checkout

If you want the full current install steps, check out [Installing TrustMCP today](./installing-trustmcp.md).

## What would change if packaged install becomes available later

Conceptually, the difference is simple:

- today, you build TrustMCP from source in your own checkout
- later, a packaged install path would mean consuming a prepared package build instead of building from a cloned repo first

That would change **how you obtain the CLI**, not what TrustMCP scans or how the core commands behave.

## What would stay the same

Even if a packaged install path exists later, people should still expect the same basic TrustMCP surface:

- the same rule set and scan model
- the same output formats
- the same `doctor`, `list-rules`, and `init-config` style entry points
- the same need to review findings in context

In other words, package delivery would be different, but the scanner itself would still be the same product.

## What this page is not saying

This page is **not** saying:

- TrustMCP is already on npm
- a packaged install command is available today
- publication timing is already decided

It is only here so future install messaging can evolve without rewriting the source-install guidance from scratch.

## Use the right doc for the current job

- For current real install steps, check out [Installing TrustMCP today](./installing-trustmcp.md).
- For pack-readiness and the final manual registry preflight, check out [the npm publish checklist](./npm-publish-checklist.md).
