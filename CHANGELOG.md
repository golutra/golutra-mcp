# Changelog

All notable changes to this project will be documented in this file.

The format follows Keep a Changelog, and this project uses Semantic Versioning.

## [0.1.0] - 2026-03-17

### Added

- Initial TypeScript `stdio` MCP server implementation
- Golutra chat, roadmap, and skill tools
- `golutra-set-context` and `golutra-get-context` for default runtime settings
- `golutra-reset-context` and `golutra-diagnose` for runtime troubleshooting
- ESLint, TypeScript, and Vitest based quality gates
- CI workflow, contribution guide, security policy, and code of conduct
- Dedicated `startup_processmd.md` for setup/start/build/validation flow

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
- Moved startup, environment, and local development instructions out of `README.md` into `startup_processmd.md`
- Replaced `README.md` again with a bilingual project-homepage version that explains what the project is, what it is today, and the future direction in English and Chinese
- Moved the remaining reference and operational material from `README.md` into `startup_processmd.md`
