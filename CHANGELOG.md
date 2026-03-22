# Changelog

All notable changes to this project will be documented in this file.

The format follows Keep a Changelog, and this project uses Semantic Versioning.

## [Unreleased]

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
