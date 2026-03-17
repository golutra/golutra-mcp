# startup_processmd

This document contains the setup, startup, build, validation, local integration steps, and the detailed operational notes previously kept in `README.md`.

## Project Reference

### Integration Boundary

- MCP clients talk to `golutra-mcp` over `stdio`
- `golutra-mcp` talks to `golutra-cli` using structured JSON commands
- `golutra-cli` talks to the running Golutra desktop instance through local IPC

This repository focuses on protocol translation, context management, diagnostics, and tool ergonomics instead of duplicating Golutra transport logic.

### Current Tool Surface

- `golutra-get-context`
- `golutra-set-context`
- `golutra-reset-context`
- `golutra-diagnose`
- `golutra-list-conversations`
- `golutra-list-messages`
- `golutra-send-message`
- `golutra-read-roadmap`
- `golutra-update-roadmap`
- `golutra-list-skills`
- `golutra-get-skill`
- `golutra-validate-skill`
- `golutra-list-project-skills`
- `golutra-read-project-skill`

### Design Principles

- Do not call Golutra local socket IPC directly from the MCP layer
- Do not rely on CLI argv fallback for programmatic behavior
- Keep tool inputs explicit even when defaults exist
- Keep diagnostics side-effect free where possible
- Prefer thin wrappers over Golutra's existing stable commands instead of inventing a parallel command model

### Diagnostics Notes

- `golutra-get-context` reads the currently stored defaults
- `golutra-set-context` updates defaults for later tool calls
- `golutra-reset-context` restores defaults from the process environment used at startup
- `golutra-diagnose` verifies `golutra-cli` reachability and, when both `workspacePath` and `userId` are available, probes app connectivity with `chat.conversations.list`

### Current Limitations

- `workspacePath` must be provided either in the tool call or through `golutra-set-context`
- Golutra-specific permissions, workflow semantics, and mention rules still come from the desktop app and `golutra-cli`
- This server currently exposes the stable Golutra commands that already exist today:
  `chat.send`, `chat.conversations.list`, `chat.messages.list`, `roadmap.read`, and `roadmap.update`
- `golutra-diagnose` uses `skills` as a CLI-level probe and `chat.conversations.list` as an app-level probe; it is not a full health API

## Prerequisites

- Node.js 20.11 or later
- A runnable `golutra-cli`
- A running Golutra desktop app for IPC-backed commands such as chat and roadmap operations

`golutra-list-skills` and `golutra-get-skill` can still work when the desktop app is not running, as long as `golutra-cli` is available.

## Maturity Status

The current project is ready for download and evaluation, but it should still be treated as an engineering preview instead of a fully battle-tested public MCP distribution.

Today it already has:

- installable package metadata
- validated build, test, and lint flow
- npm packaging verification
- a working stdio MCP server entrypoint

It still needs more real-world validation across MCP hosts, operating systems, and Golutra app or CLI versions before it should be treated as fully mature.

## Environment Variables

- `GOLUTRA_CLI_PATH`
  Default: auto-discover the macOS app-bundled CLI when available, otherwise `golutra-cli`
- `GOLUTRA_PROFILE`
  Optional Golutra runtime profile: `dev`, `canary`, or `stable`
- `GOLUTRA_WORKSPACE_PATH`
  Optional default workspace path used by tools that require a workspace
- `GOLUTRA_COMMAND_TIMEOUT_MS`
  Default: `30000`

Use [.env.example](./.env.example) as the minimal local template.

## Install Dependencies

```bash
npm install
```

## Global Installation

If you want to install it like a normal downloadable MCP package:

```bash
npm install -g golutra-mcp
```

Then configure your MCP client to launch `golutra-mcp` directly.

## Local Development

Start the MCP server directly from source:

```bash
npm run dev
```

## Build

Build the distributable output:

```bash
npm run build
```

## Validation

Run the full project checks:

```bash
npm run check
```

Available scripts:

- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run check`
- `npm run package:check`
- `npm run clean`

Real MCP smoke test:

```bash
export GOLUTRA_E2E_CLI_PATH=/absolute/path/to/golutra-cli
export GOLUTRA_E2E_WORKSPACE_PATH=/absolute/path/to/workspace
npm run test:e2e
```

Optional app-backed probe:

```bash
export GOLUTRA_E2E_USER_ID=<workspace-member-id>
npm run test:e2e
```

When `GOLUTRA_E2E_USER_ID` is set, the smoke test also requires a running Golutra desktop app and verifies `chat.conversations.list` through `golutra-diagnose`.

## Example MCP Client Configuration

Example for a local `stdio` client:

```json
{
  "mcpServers": {
    "golutra": {
      "command": "node",
      "args": ["/absolute/path/to/golutra-mcp/dist/index.js"],
      "env": {
        "GOLUTRA_CLI_PATH": "/absolute/path/to/golutra-cli",
        "GOLUTRA_PROFILE": "stable",
        "GOLUTRA_WORKSPACE_PATH": "/absolute/path/to/workspace"
      }
    }
  }
}
```

If you publish the package globally, the command can be changed to `golutra-mcp`.

## Packaging

Before packaging or publishing:

```bash
npm run build
npm pack --dry-run
```

`prepack` is configured to build the project before npm packaging.

## Self-Hosted E2E CI

The repository includes a dedicated GitHub Actions workflow for real MCP smoke tests on a macOS self-hosted runner:

- Workflow file: `.github/workflows/e2e-self-hosted.yml`
- Trigger: manual `workflow_dispatch`
- Goal: verify `golutra-mcp -> golutra-cli -> Golutra app/skills` against a real local environment

Recommended runner prerequisites:

- macOS runner with a logged-in desktop session when app-backed checks are needed
- Runnable Golutra desktop app and bundled `golutra-cli`
- Node.js available or installable through `actions/setup-node`
- A stable local workspace path that contains the expected `.golutra` metadata

Repository variables:

- `GOLUTRA_E2E_WORKSPACE_PATH`: required unless provided as a workflow input
- `GOLUTRA_E2E_CLI_PATH`: optional, defaults to `/Applications/Golutra.app/Contents/MacOS/golutra-cli`
- `GOLUTRA_E2E_PROFILE`: optional, defaults to `stable`
- `GOLUTRA_E2E_USER_ID`: required only when the workflow is run with `app_probe=true`

Suggested operating model:

- Keep `ci.yml` fast and environment-agnostic for ordinary PRs
- Use `e2e-self-hosted.yml` as the release gate or pre-publish smoke test
- Enable `app_probe=true` only on runners where the Golutra desktop app is already running and signed in
