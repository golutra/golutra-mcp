# STARTUP_PROCESS

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
- `golutra-diagnose` now returns layered checks for `cliPath`, `cliCommand`, `workspace`, `userId`, and `appConnection`
- `golutra-diagnose` also returns `summary.status` (`ok`, `partial`, `error`), `reasonCodes`, and `nextSteps`
- Detailed output examples and common `reasonCode` values live in `docs/GOLUTRA_DIAGNOSE_EXAMPLES.md`

### Workspace Override Contract

- Passing `workspacePath` in a tool call is a one-time override for that call only
- `golutra-set-context` is the explicit operation that persists a new default `workspacePath` for later calls
- If an AI host switches workspaces frequently, prefer passing `workspacePath` per call instead of mutating shared defaults
- 如果只是某一次调用临时切换工作区，直接在该次 tool 输入里传 `workspacePath`
- 如果希望后续调用默认都切到新工作区，再使用 `golutra-set-context`
- Concrete request sequences are documented in `docs/WORKSPACE_CONTEXT_EXAMPLES.md`

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
  Default: auto-discover a platform-specific `golutra-cli` install when available, otherwise fall back to the platform command name from `PATH`
- `GOLUTRA_PROFILE`
  Optional Golutra runtime profile: `dev`, `canary`, or `stable`
- `GOLUTRA_WORKSPACE_PATH`
  Optional default workspace path used by tools that require a workspace
- `GOLUTRA_COMMAND_TIMEOUT_MS`
  Default: `30000`

Use [.env.example](./.env.example) as the minimal local template.

Default CLI discovery order:

- macOS: `/Applications/Golutra.app/Contents/MacOS/golutra-cli`, `~/Applications/Golutra.app/Contents/MacOS/golutra-cli`, `golutra-cli`
- Windows: `%LOCALAPPDATA%\Programs\Golutra\golutra-cli.exe`, `%ProgramFiles%\Golutra\golutra-cli.exe`, `%ProgramFiles(x86)%\Golutra\golutra-cli.exe`, `golutra-cli.exe`
- Linux: `~/.local/bin/golutra-cli`, `~/.cargo/bin/golutra-cli`, `/usr/local/bin/golutra-cli`, `/usr/bin/golutra-cli`, `/opt/Golutra/golutra-cli`, `/app/bin/golutra-cli`, `golutra-cli`

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

Typical launch examples by platform:

macOS:

```bash
export GOLUTRA_CLI_PATH=/Applications/Golutra.app/Contents/MacOS/golutra-cli
export GOLUTRA_PROFILE=stable
export GOLUTRA_WORKSPACE_PATH=/absolute/path/to/workspace
golutra-mcp
```

Windows PowerShell:

```powershell
$env:GOLUTRA_CLI_PATH="C:\Users\<you>\AppData\Local\Programs\Golutra\golutra-cli.exe"
$env:GOLUTRA_PROFILE="stable"
$env:GOLUTRA_WORKSPACE_PATH="C:\absolute\path\to\workspace"
golutra-mcp
```

Linux:

```bash
export GOLUTRA_CLI_PATH=/usr/bin/golutra-cli
export GOLUTRA_PROFILE=stable
export GOLUTRA_WORKSPACE_PATH=/absolute/path/to/workspace
golutra-mcp
```

## Quick Verification After Install

Use this sequence when you want to confirm that the published package and the local Golutra runtime are wired correctly.

1. Confirm the package is visible from npm:

```bash
npm view golutra-mcp version
```

2. Confirm the binary can start with your local Golutra runtime settings:

macOS/Linux:

```bash
export GOLUTRA_CLI_PATH=/absolute/path/to/golutra-cli
export GOLUTRA_PROFILE=stable
export GOLUTRA_WORKSPACE_PATH=/absolute/path/to/workspace
golutra-mcp
```

Windows PowerShell:

```powershell
$env:GOLUTRA_CLI_PATH="C:\absolute\path\to\golutra-cli.exe"
$env:GOLUTRA_PROFILE="stable"
$env:GOLUTRA_WORKSPACE_PATH="C:\absolute\path\to\workspace"
golutra-mcp
```

3. If your MCP host can call tools immediately, run `golutra-get-context` or `golutra-diagnose`.

What to expect:

- `golutra-get-context` should return the resolved `cliPath`, `profile`, `workspacePath`, and `timeoutMs`
- `golutra-diagnose` should report `checks.cliPath.ok = true` and `checks.cliCommand.ok = true`
- If you also provide a valid workspace `userId`, `golutra-diagnose` should attempt the app-backed `chat.conversations.list` probe

If installation succeeds but runtime access still fails, use `golutra-diagnose` first and then compare the output with `docs/GOLUTRA_DIAGNOSE_EXAMPLES.md`.

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

## Publish To npm

Use this flow for a normal public npm release:

1. Confirm you are in the repository root and that checks pass:

```bash
cd /path/to/golutra-mcp
npm run check
npm pack
```

2. Confirm your npm CLI session is authenticated:

```bash
npm whoami
```

3. Publish the package:

```bash
npm publish
```

4. Verify the published result:

```bash
npm view golutra-mcp version
npm view golutra-mcp
```

Release notes:

- If `npm publish` reports that the version already exists, bump `package.json` to the next version and publish again
- If npm requires browser or OTP confirmation, complete that flow and wait for the CLI to print `+ golutra-mcp@<version>`
- `npm pack` creates a local `.tgz` artifact in the repository root; this is useful for pre-publish inspection or private file distribution

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
- `GOLUTRA_E2E_CLI_PATH`: optional, defaults to the same platform-specific discovery rules as runtime startup; macOS runners commonly use `/Applications/Golutra.app/Contents/MacOS/golutra-cli`
- `GOLUTRA_E2E_PROFILE`: optional, defaults to `stable`
- `GOLUTRA_E2E_USER_ID`: required only when the workflow is run with `app_probe=true`

Suggested operating model:

- Keep `ci.yml` fast and environment-agnostic for ordinary PRs
- Use `e2e-self-hosted.yml` as the release gate or pre-publish smoke test
- Enable `app_probe=true` only on runners where the Golutra desktop app is already running and signed in
