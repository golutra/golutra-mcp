# STARTUP_PROCESS

This document contains the setup, startup, build, validation, local integration steps, and the detailed operational notes previously kept in `README.md`.

## Project Reference

### Integration Boundary

- MCP clients talk to `golutra-mcp` over `stdio`
- `golutra-mcp` talks to `golutra-cli` using structured JSON commands
- `golutra-cli` talks to the selected Golutra desktop/Web Host through local IPC

This repository focuses on protocol translation, context management, diagnostics, and tool ergonomics instead of duplicating Golutra transport logic.

### Current Tool Surface

- `golutra-get-context`
- `golutra-set-context`
- `golutra-reset-context`
- `golutra-diagnose`
- `golutra-list-conversations`
- `golutra-list-messages`
- `golutra-send-messages`
- `golutra-read-inbox`
- `golutra-read-roadmap`
- `golutra-update-roadmap`
- `golutra-list-skills`
- `golutra-get-skill`
- `golutra-validate-skill`
- `golutra-list-project-skills`
- `golutra-read-project-skill`
- `golutra-update-member-name`
- `golutra-export-template-workspace`
- `golutra-publish-template-edited`

### Design Principles

- Do not call Golutra local socket IPC directly from the MCP layer
- CLI argv message sending is removed; use structured stdin
- Let the CLI/Host fill verified context; require explicit destinations only when they cannot be determined
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

- Workspace-scoped read/management tools require `workspacePath` in the call or context. Member send/inbox commands may infer it from a verified terminal caller; detached local operators must explicitly supply their own senderId and workspacePath.
- Golutra-specific permissions, workflow semantics, and mention rules still come from the desktop app and `golutra-cli`
- This server currently exposes the stable Golutra commands that already exist today:
  `chat.send.batch`, `chat.inbox.read`, `chat.conversations.list`, `chat.messages.list`, `roadmap.read`, and `roadmap.update`
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
  Paired CLI executable path, without shell quoting. Required as an absolute path for dev/canary; inherited automatically inside updated member terminals. Stable can discover an installation or use PATH when unset.
- `GOLUTRA_PROFILE`
  Optional Golutra runtime profile: `dev`, `canary`, or `stable`
- `GOLUTRA_CLI_HOST_KIND`
  Optional Golutra runtime host: `desktop` or `server`; `web` maps to `server`
- `GOLUTRA_TARGET_ORDER`
  Deprecated compatibility option: accepts one explicit target, for example `dev:server`. Multiple targets are rejected to prevent cross-runtime replay.
- `GOLUTRA_WORKSPACE_PATH`
  Optional default workspace path used by tools that require a workspace
- `GOLUTRA_COMMAND_TIMEOUT_MS`
  Default: `30000`

Use [.env.example](./.env.example) as the minimal local template.

When profile/host are not pinned, the CLI owns discovery. `GOLUTRA_RUNTIME_PROFILE` is inherited when `GOLUTRA_PROFILE` is unset. CLI auto host order is server then desktop within that profile; explicit `GOLUTRA_COMMAND_IPC_ADDR` still has highest priority. MCP does not retry a command in another runtime.

Use the updated CLI with `info` and `--timeout-ms`. `golutra-cli-info` reports CLI path/version and Host instance identity. Protocol v2 Hosts retain completed async results for 15 minutes; `golutra-run-command` with `asynchronous: true` returns a handle for `golutra-wait-command`. Host restart clears handles. Wait timeout and CLI process timeout do not cancel backend execution.

Chat tools reuse `golutra-cli chat send --stdin`, `chat inbox --stdin`, and `chat send --retry <path>`. Other structured commands use `run --stdin`; JSON is never placed in argv. Send one message with `text`, a batch with `messages`, or retry the saved original request with `retryFile`. Add `to` or `replyTo` only when needed; only add other context if requested by a CLI error. `golutra-read-inbox` normally takes no arguments and returns all pages; cursor is no longer a tool argument. Read chat help only when unclear and follow the current MCP input schema.

Success preserves the CLI envelope with `result.data.items` and `retryFile`. On failure, `response` retains the full CLI JSON and `retryFile` is also exposed directly. The CLI emits a JSON stderr diagnostic `{ "type": "chat.retry", "retryFile": "..." }` before sending, so a killed CLI can still report the saved request. Never turn timeout into a new send or switch runtimes. CLI and Host must both be updated; new MCP checks the capabilities `chatSendDraft`, `chatRetryFile`, `chatInboxAllPages`, `chatRetryDiagnostic`. Failed checks are not cached. Successful checks are reused for the same CLI/profile/Host configuration; restart MCP after replacing its CLI binary.

New Golutra member terminals inherit the paired absolute `GOLUTRA_CLI_PATH` from the Host, including MCP children. Standalone dev/canary clients must configure an absolute path to their build via that environment variable or `golutra-set-context`; automatic installed-program discovery is rejected before execution in these profiles. Stable can still use the installation discovery below. The Node runner uses a program path and argument array, not a shell command: do not add shell quoting to `cliPath`.

Some MCP clients filter inherited environment variables. In that case, explicitly forward the existing `GOLUTRA_CLI_PATH`, `GOLUTRA_RUNTIME_PROFILE`, `GOLUTRA_CLI_HOST_KIND`, `GOLUTRA_COMMAND_IPC_ADDR`, `GOLUTRA_COMMAND_IPC_PATH`, and `GOLUTRA_COMMAND_SCOPE_TOKEN` from the member process. Forward variable names; do not copy a member token into shared configuration. Without these, a client may discover the installed CLI or lose the member's verified context. A standalone client has no member token to forward and must follow the local-operator contract.

For Codex member clients, the MCP configuration can forward them with:

```toml
[mcp_servers.golutra]
command = "golutra-mcp"
env_vars = ["GOLUTRA_CLI_PATH", "GOLUTRA_RUNTIME_PROFILE", "GOLUTRA_CLI_HOST_KIND", "GOLUTRA_COMMAND_IPC_ADDR", "GOLUTRA_COMMAND_IPC_PATH", "GOLUTRA_COMMAND_SCOPE_TOKEN"]
```

Restart the member/client after updating its MCP configuration, then use `golutra-get-context` and `golutra-cli-info` to verify the paired path and dev/stable target before sending.

Each member client must launch its own stdio MCP process as a descendant of that member. The executable and configuration can be shared; the process identity and inherited scope cannot. Host verifies the actual caller, rather than inferring a sender from a display name or a stored default workspace. A detached shared runner cannot automatically represent every member. `golutra-get-context` and `golutra-cli-info` verify runtime selection, not member identity; verify identity using the member's inbox and persisted send results.

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

The `Release` workflow in `.github/workflows/release.yml` publishes the single
cross-platform npm package. It reuses `ci.yml` to run checks on Linux, macOS and
Windows; all three must pass before packaging. Only a pushed `vX.Y.Z` tag can
publish. `package.json`, `package-lock.json`, the tag, and the changelog must
agree on the stable version.

### One-time npm trusted publisher setup

An npm package maintainer must bind `golutra-mcp` to this GitHub Actions workflow
in the package's npm settings:

- Organization/user: `golutra`
- Repository: `golutra-mcp`
- Workflow filename: `release.yml`
- Environment: leave empty (the workflow does not declare one)
- Permission: allow publishing

With npm 11.15.0 or newer, the equivalent command is:

```bash
npm trust github golutra-mcp --repository golutra/golutra-mcp --file release.yml --allow-publish
```

This account change requires npm's authentication/2FA flow. Committing the
workflow does not configure that trust. The publish job uses `id-token: write`
and npm 11.17.0 for OIDC, with `--provenance`; no `NPM_TOKEN`, copied local
credential, or bootstrap secret is needed for this already-existing package.

See [npm trusted publishers](https://docs.npmjs.com/trusted-publishers) and
[npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust).

### Preview without publishing

Run **Actions → Release → Run workflow**, selecting the branch to check, or:

```bash
gh workflow run release.yml --ref main
```

Every manual run is a dry run, even if a tag is selected. It runs all checks,
builds and packs, checks public npm metadata, and uploads the package plus
checksums as a workflow artifact. It also runs `npm publish --dry-run` for a new
version; npm rejects even dry runs for an existing version, so that step is
explicitly skipped when the registry already has the version. It never uploads a
version to npm or creates a GitHub Release, and it does not test OIDC publishing
permission. A preview of an already-published version reports whether the
candidate archive matches; differences do not overwrite the published package.

### Publish a new version

1. Update `package.json`, `package-lock.json`, and the versioned `CHANGELOG.md`
   entry, and complete the real CLI/Host smoke check appropriate to the changes.
2. Run `npm run check`, commit, and push the reviewed release commit to `main`.
3. Create an annotated `vX.Y.Z` tag on that commit and push that tag. Substitute
   the actual new version in these commands; do not recreate an existing tag:

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin refs/tags/vX.Y.Z
```

The workflow publishes the checked tarball using OIDC, waits up to five minutes
for npm processing (plus bounded request timeouts), checks its public integrity,
and creates a GitHub Release with the version's changelog, tarball, and SHA-256
checksum. GitHub-hosted checks do not replace a real Golutra CLI/Host smoke test.

4. Verify the workflow result and the registry:

```bash
npm view golutra-mcp@X.Y.Z version dist.integrity --json --registry=https://registry.npmjs.org/
npm view golutra-mcp dist-tags --json --registry=https://registry.npmjs.org/
```

### Retry and processing failures

- Re-running the original tag workflow skips npm upload only when the existing
  version has exactly the same archive integrity. Different content fails before
  publication; never move a published tag or try to overwrite its npm version.
- HTTP 404 means the version is not yet publicly available. Authentication,
  network, rate-limit and server errors fail the lookup instead of being treated
  as an unused version. A staged version can also return 404 while processing.
- If npm reports processing or `E409`/`previously staged`, check its public
  status first. Do not automatically bump the version or repeat publishing.
  A duplicate-version error does not prove OIDC authentication works.
- The existing `v0.1.5` predates this workflow. Keep its tag and npm artifact
  unchanged; use a manual branch preview to validate the new automation.

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
