# Security Policy

## Supported Versions

Until the project reaches `1.0.0`, only the latest `0.x` release is supported for security fixes.

## Reporting a Vulnerability

Please do not open a public issue for vulnerabilities involving any of the following:

- arbitrary command execution
- workspace data exposure
- credential leakage
- unsafe handling of local Golutra IPC or CLI paths

Use the repository host's private security reporting channel if it exists. If that is unavailable, contact the maintainers privately through the hosting platform before public disclosure.

## Scope Notes

This project delegates core command execution to `golutra-cli`. Vulnerability reports should clearly identify whether the issue is in:

- `golutra-mcp`
- `golutra-cli`
- the Golutra desktop app

If the root cause is upstream in Golutra, include the exact CLI command or MCP tool call that reproduces it.
