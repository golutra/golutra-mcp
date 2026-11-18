# Changelog

All notable changes to this project will be documented in this file.

The format follows Keep a Changelog, and this project uses Semantic Versioning.

## [Unreleased]

## [0.1.8] - 2026-11-18

Cross-workspace channels require the matching updated Golutra CLI and Host.
Refresh the MCP client's tool list to load the new invitation and channel schemas.
For official Web remote control, deploy the matching ERP relay route policy too.

### Added

- Invite existing members from registered workspaces into ordinary channels with
  `externalMembers: [{ workspaceId, memberId }]`. The channel keeps its original
  history while members keep their own terminal, session and inbox queue.
- Query joined external channels through `externalChannels`, read their text
  history with the source `workspaceId`, and send using
  `to: { workspaceId, conversationId, mentionIds }` without changing MCP identity.
- Check `chatCrossWorkspaceChannels` on both CLI and Host before these operations;
  older Hosts reject the new feature explicitly. Default channels and local file
  permissions remain unchanged. Compatible local chat remains available with
  older CLI/Host pairs.

## [0.1.7] - 2026-11-18

Cross-workspace messaging requires the matching updated Golutra CLI and Host.
Refresh the MCP client's tool list to discover `golutra-list-chat-contacts`.
Keep the sender's source context; put the recipient workspace in `to.workspaceId`.

### Added

- Add `golutra-list-chat-contacts` for verified member addresses in other
  registered workspaces on the current Host/profile. Communication is available
  by default without a settings switch.
- Extend the existing private-message target with optional `workspaceId`.
  Preserve minimal replies, batching, per-item results and saved retry requests.
- Document `pending_transfer`, source identity verification and the text-only
  boundary; groups and local files are not shared across workspaces.

### Fixed

- Require the `chatCrossWorkspace` CLI capability before listing external
  contacts or submitting cross-workspace destinations, including mixed batches.
  Validate each operation against the cached capability snapshot so a prior
  local send cannot bypass the check. Existing local messaging stays available
  with compatible older CLI/Host pairs; no automatic runtime switching occurs.

## [0.1.6] - 2026-11-17

Group collaboration requires the updated Golutra CLI/Host. Refresh the MCP
client's tool list to discover `golutra-add-channel-members`. Member terminals
can omit identity and workspace fields; unbound local operators still supply
their own context. Creating a group or adding members does not dispatch tasks.

### Added

- Add `golutra-add-channel-members` to append existing workspace members through
  the Host's atomic membership command, preserving concurrent additions and
  treating repeated additions as successful no-ops. Requires the updated CLI/Host.
- Add a tag-triggered npm release workflow with Linux/macOS/Windows checks,
  exact version validation, OIDC provenance, public artifact integrity
  verification, and GitHub Release assets. Manual runs are previews only.
- Document the one-time npm trusted publisher setup and safe handling of
  already-published or still-processing versions.

### Changed

- Let member terminals query conversations without fields and create groups
  using the group name and member IDs. The Host supplies verified identity and
  workspace; explicit mismatches are rejected. Clarify group creation, addition,
  intentional full membership replacement, and separate task dispatch.

### Fixed

- Use the operating system's temporary directory in the IPC diagnostics test
  so Windows CI reaches the intended connection-failure assertion.

## [0.1.5] - 2026-11-13

This release changes the messaging tool contract. Refresh the client's tool list and update Golutra CLI and Host together. Use `golutra-send-messages` with `text`, `messages`, or `retryFile`; inspect `result.data.items` on success and `response` on failure. The removed singular send tool and inbox cursor are not supported.

### Changed

- Simplify `golutra-send-messages`: use `text` for a single message, `messages` for a batch, or `retryFile` to retry the saved original request. Delegate identity, reply-source inference and retry keys to CLI/Host.
- `golutra-read-inbox` defaults to the current verified inbox and delegates all pagination to the CLI. Remove the cursor argument.
- Successful sends now return the CLI envelope (`result.data.items`, `retryFile`) instead of a flat batch result. Failures preserve the complete CLI JSON in `response` and expose `retryFile`, including a process timeout after the CLI saved its request. Require CLI capabilities instead of guessing support from the version number.
- Publish the complete concise input schema to MCP clients and validate mutually exclusive send/retry modes at the call boundary. Document environment forwarding for clients such as Codex that filter inherited member variables.
- dev/canary requires a configured absolute CLI path; updated member terminals inherit their Host's paired path. Stable installation discovery remains available.
- Remove the legacy `golutra-send-message` tool and client mapping. Refresh the MCP tool list and update CLI/Host together; sending requires SQLite storage.
- Send structured commands through stdin and preserve CLI failure codes/request IDs. Reap timed-out child processes; a timeout does not cancel Host execution.
- Delegate runtime discovery to the CLI. Remove automatic desktop/server and stable/dev replay; legacy `targetOrder` accepts only one explicit target.
- Add `golutra-send-messages`, `golutra-read-inbox`, `golutra-cli-info`, and `golutra-wait-command`; support async submission on `golutra-run-command` and complete guide references with `full: true`.
- Preserve batch partial failures and stable retry keys in the saved request; never replay across runtimes.
- Requires the updated Golutra CLI with `info` and `--timeout-ms`. Repeatable async results require command protocol v2 on the Host.

## [0.1.4] - 2026-05-07

### Added

- Added `golutra-update-member-name` for renaming one project member by `memberId` without changing bindings, prompts, automation, conversations, or terminal sessions.
- Added focused template export tools: `golutra-export-template-workspace` for exporting workspace content into My Templates with create/replace modes, and `golutra-publish-template-edited` for exporting one My Templates card as a zip file.

### Changed

- Clarified template export tool descriptions so MCP hosts distinguish the two real actions: workspace-to-My-Templates and My-Templates-card-to-zip.

## [0.1.3] - 2026-05-01

### Added

- Added focused MCP tools for Golutra team creation, member configuration, conversations, prompt settings, automation, skills, agents, templates, store commands, and generic structured command fallback.
- Added `golutra-read-cli-guide` so MCP hosts can read the current Golutra CLI team, collaboration, prompt, role, asset, and roadmap guidance directly.
- Added runtime target fallback for app-backed tools. MCP now tries `stable:desktop`, `stable:server`, `dev:desktop`, then `dev:server` by default, while still allowing explicit `profile`, `hostKind`, or `targetOrder` overrides.
- Added explicit confirmation fields for destructive or restart operations such as member deletion, conversation deletion, and member restart.

### Changed

- Kept `golutra-cli` as the stable integration boundary and injects `GOLUTRA_CLI_HOST_KIND` only for each spawned CLI child process.
- Updated documentation, environment examples, generated `dist/`, and tests for the expanded tool surface and runtime selection behavior.

## [0.1.2] - 2026-03-22

### Changed

- Clarified the runtime `workspacePath` contract so per-tool `workspacePath` input is treated as a one-time override, while `golutra-set-context` remains the only way to persist a new default workspace
- Added regression tests to lock the workspace context behavior at both `ContextStore` level and workspace-aware tool level
- Expanded README and `STARTUP_PROCESS.md` so AI hosts can understand the recommended runtime flow for diagnostics, workspace switching, and normal tool execution
- Added `docs/WORKSPACE_CONTEXT_EXAMPLES.md` with concrete examples for stored defaults, one-off workspace overrides, recommended tool order, and a real chat flow
- Updated the diagnostic examples to explain that a `workspacePath` passed to `golutra-diagnose` affects only that call and does not mutate the stored default context

## [0.1.1] - 2026-03-21

### Changed

- Synced `scripts/e2e-smoke.mjs` with the layered `golutra-diagnose` output so self-hosted smoke tests validate the current diagnostic contract
- Expanded the basic GitHub Actions check workflow to run on Linux, macOS, and Windows so platform-specific regressions surface earlier
- Included `docs/` in the npm publish file list so packaged users can open the referenced diagnostic example document locally
- Renamed `startup_processmd.md` to `STARTUP_PROCESS.md` and updated repository links to use a stable public-facing document name
- Removed stale `mcp-golutra` wording from the bug report template so issue reports match the published package name
- Stopped hardcoding the MCP server runtime version in source scripts and now read it from `package.json`

## [0.1.0] - 2026-03-17

### Added

- Initial TypeScript `stdio` MCP server implementation
- Golutra chat, roadmap, and skill tools
- `golutra-set-context` and `golutra-get-context` for default runtime settings
- `golutra-reset-context` and `golutra-diagnose` for runtime troubleshooting
- ESLint, TypeScript, and Vitest based quality gates
- CI workflow, contribution guide, security policy, and code of conduct
- Dedicated `STARTUP_PROCESS.md` for setup/start/build/validation flow

### Changed

- Fixed `golutra-list-skills` so it now inherits the stored `workspacePath` from `golutra-set-context`, keeping skill discovery behavior consistent with the other workspace-aware tools
- Added `npm run test:e2e`, a real stdio MCP smoke test for the `golutra-mcp -> golutra-cli` path, with optional app-backed verification through `golutra-diagnose`
- Added `.github/workflows/e2e-self-hosted.yml` so maintainers can run the same smoke test on a macOS self-hosted runner before release
- Re-generated `package-lock.json` against the official npm registry and added public package metadata for repository, homepage, bugs, and author fields
- Split README startup guidance into a safer “try from source first, then install globally” flow for public users
- Replaced the project license from MIT to Apache-2.0 for clearer patent and redistribution terms
- Started tracking the built `dist/` output so GitHub source archives also include runnable server files instead of documentation only
- Switched the user-facing default profile examples from `dev` to `stable` so published usage aligns with the release app instead of development builds
- Reworked `README.md` into a project-introduction document focused on purpose, architecture, tool surface, and design boundaries
- Moved startup, environment, and local development instructions out of `README.md` into `STARTUP_PROCESS.md`
- Replaced `README.md` again with a bilingual project-homepage version that explains what the project is, what it is today, and the future direction in English and Chinese
- Moved the remaining reference and operational material from `README.md` into `STARTUP_PROCESS.md`
