# Contributing

## Development Requirements

- Node.js 20.11+
- npm 10+
- A working `golutra-cli` if you want to run end-to-end manual checks against a live Golutra app

## Setup

```bash
npm install
npm run check
```

## Project Structure

- `src/index.ts`
  MCP server bootstrap and `stdio` transport startup
- `src/lib/context.ts`
  Runtime defaults and workspace/profile resolution
- `src/lib/cli-runner.ts`
  Child-process execution and JSON parsing for `golutra-cli`
- `src/lib/golutra-client.ts`
  Structured Golutra command mapping
- `src/lib/toolkit.ts`
  MCP tool registration
- `test/`
  Unit tests for non-IPC logic

## Contribution Rules

- Keep Golutra integration behind `golutra-cli`; do not bypass it with direct IPC unless the project intentionally changes architecture.
- Prefer adding typed wrapper methods in `src/lib/golutra-client.ts` over embedding raw CLI calls inside tools.
- Keep tool inputs explicit and avoid hidden state beyond the documented default context.
- Keep diagnostic tools lightweight and side-effect free whenever possible.
- Do not log to stdout. MCP `stdio` transport must own stdout.
- If you need runtime diagnostics, use stderr only.

## Validation

Before opening a pull request, run:

```bash
npm run check
```

If you changed MCP transport wiring, runtime context behavior, or CLI integration semantics, also run:

```bash
npm run test:e2e
```

For repository maintainers, the corresponding hosted verification lives in `.github/workflows/e2e-self-hosted.yml` and is intended for a macOS self-hosted runner with a real Golutra environment.

## Pull Requests

- Keep PRs focused on one logical change
- Update `README.md` and `CHANGELOG.md` when user-facing behavior changes
- Add or update tests when the change affects parsing, command mapping, or tool behavior
