# Security Policy

TrustMCP is a static audit CLI. It does not execute untrusted code, and it does not guarantee that scanned targets are safe.

## Reporting a vulnerability in TrustMCP

If you find a vulnerability in this repository itself, please report it privately to the maintainer before opening a public issue.

If a dedicated private security channel is not published yet, open a regular issue that asks for a private contact path **without including exploit details**.

When you report a problem, include:

- affected version or commit
- reproduction steps
- impact
- any suggested fix

## Scope notes

Please do not report these as vulnerabilities:

- TrustMCP missing a rule for a risk it does not claim to cover
- TrustMCP saying `No matching rules were triggered.` for a target that still has other risks
- TrustMCP not supporting private GitHub repositories, auth, or runtime sandboxing

Those are current product boundaries, not security bugs.
