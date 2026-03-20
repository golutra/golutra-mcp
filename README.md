<p align="center">
  <a href="https://www.golutra.com/" target="_blank" rel="noopener noreferrer">
    <img
      width="96"
      src="./assets/readme/golutra-logo.png"
      alt="golutra logo"
    />
  </a>
</p>

<h1 align="center">golutra-mcp</h1>

<p align="center">
  MCP bridge for Golutra via golutra-cli. <br />
  通过 golutra-cli 暴露 Golutra 能力的 MCP 桥接层。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/golutra-mcp"><img src="https://img.shields.io/npm/v/golutra-mcp?label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/golutra-mcp"><img src="https://img.shields.io/npm/dm/golutra-mcp?label=downloads" alt="npm downloads"></a>
  <a href="https://github.com/golutra/golutra-mcp/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/golutra/golutra-mcp/ci.yml?branch=main&label=ci" alt="ci"></a>
  <a href="https://www.npmjs.com/package/golutra-mcp"><img src="https://img.shields.io/badge/node-%3E%3D20.11-2f7af8" alt="node version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-ff9f1a" alt="license"></a>
</p>

<p align="center">
  <a href="#english">English</a> ·
  <a href="#中文">中文</a> ·
  <a href="https://www.npmjs.com/package/golutra-mcp">npm</a> ·
  <a href="https://github.com/golutra/golutra-mcp">GitHub</a> ·
  <a href="./STARTUP_PROCESS.md">Startup Process</a> ·
  <a href="./docs/GOLUTRA_DIAGNOSE_EXAMPLES.md">Diagnose Examples</a>
</p>

<p align="center">
  Keep Golutra as the app runtime. Use golutra-cli as the stable boundary. Expose the workflow through MCP. <br />
  保留 Golutra 作为桌面运行时，以 golutra-cli 作为稳定边界，再通过 MCP 暴露给外部 AI 宿主。
</p>

---

## English

### Install

`golutra-mcp` is now published on npm as `golutra-mcp`.

Install it as a normal MCP server package:

```bash
npm install -g golutra-mcp
```

Run it with a published Golutra desktop installation.

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

### What This Project Is

`golutra-mcp` is a Model Context Protocol server that exposes Golutra collaboration capabilities to MCP-compatible hosts through `golutra-cli`.

It is not a replacement for Golutra itself, and it does not re-implement Golutra's local IPC protocol. Instead, it acts as a thin integration layer that lets external MCP clients reuse Golutra's existing chat, roadmap, and skill flows through a smaller and more stable boundary.

### What It Is Today

The current project is an installable public MCP server release with its first npm distribution already published.

Today it already provides:

- a local `stdio` MCP server
- a command bridge based on `golutra-cli`
- tool coverage for chat, roadmap, context, diagnostics, and skill discovery
- skill validation and direct project `SKILL.md` reading for local Golutra skill workflows
- an open-source project skeleton with contribution, security, CI, and release-facing metadata

At the current stage, it should be understood as a real downloadable integration package that is ready for evaluation, pilot usage, and downstream MCP wiring, but still needs broader real-world validation before it should be treated as a fully hardened long-term public integration product.

### Why It Exists

The goal is to let MCP hosts talk to Golutra without forcing them to understand Golutra internals.

That means this repository is mainly responsible for:

- protocol translation
- runtime context management
- safe command wrapping
- diagnostics and integration ergonomics

### Runtime Requirements

To work correctly, the server still depends on the existing Golutra desktop runtime:

- a locally installed Golutra desktop application
- a reachable `golutra-cli` binary
- a valid Golutra workspace path
- the target Golutra desktop app profile running locally, usually `stable`

Default CLI discovery by platform:

- macOS: `/Applications/Golutra.app/Contents/MacOS/golutra-cli`, then `~/Applications/Golutra.app/Contents/MacOS/golutra-cli`, then `golutra-cli` from `PATH`
- Windows: `%LOCALAPPDATA%\Programs\Golutra\golutra-cli.exe`, then `%ProgramFiles%\Golutra\golutra-cli.exe`, then `%ProgramFiles(x86)%\Golutra\golutra-cli.exe`, then `golutra-cli.exe` from `PATH`
- Linux: `~/.local/bin/golutra-cli`, then `~/.cargo/bin/golutra-cli`, then `/usr/local/bin/golutra-cli`, `/usr/bin/golutra-cli`, `/opt/Golutra/golutra-cli`, `/app/bin/golutra-cli`, then `golutra-cli` from `PATH`

### Diagnostics

Use `golutra-diagnose` when you need to separate:

- CLI path problems
- missing or invalid workspace paths
- missing user identity for app-backed probes
- app-not-running or profile-mismatch failures
- generic app command failures

Detailed diagnostic output fields and common `reasonCode` values are documented in `docs/GOLUTRA_DIAGNOSE_EXAMPLES.md`.

### What An AI Host Should Do

If an AI system or MCP-compatible host sees this repository, the intended usage is:

1. Launch `golutra-mcp` as a local `stdio` MCP server, not as an HTTP service.
2. Provide `GOLUTRA_CLI_PATH`, `GOLUTRA_PROFILE`, and usually `GOLUTRA_WORKSPACE_PATH`.
3. Call `golutra-get-context` or `golutra-diagnose` first to confirm runtime readiness.
4. Use the structured tool flow instead of inventing a custom transport:
   `golutra-list-conversations` -> `golutra-list-messages` / `golutra-send-message` / `golutra-read-roadmap` / `golutra-update-roadmap`.
5. Treat `golutra-cli` as the stable boundary. Do not bypass this project by directly calling Golutra local socket IPC unless you intentionally want to maintain a separate integration layer.

In short: start with diagnostics, keep workspace and profile explicit, and use the provided MCP tools as the integration contract.

### Future Direction

The next stages should move the project from "basic bridge" to "usable integration product."

Likely future work includes:

- richer typed result models instead of mostly pass-through payloads
- stronger health checks and diagnostics for CLI, profile, workspace, and app status
- clearer MCP resource/prompt support in addition to tool calls
- better packaging and publish flow once dependency install and build are stable in target environments
- tighter documentation around real Golutra collaboration workflows
- stronger release hardening across installation paths, packaging validation, and end-to-end compatibility checks

### Source Development

If you want to run or modify the repository from source instead of installing the npm package:

```bash
npm install
export GOLUTRA_CLI_PATH=/absolute/path/to/golutra-cli
export GOLUTRA_PROFILE=stable
export GOLUTRA_WORKSPACE_PATH=/absolute/path/to/workspace
npm run dev
```

Detailed startup, validation, and client wiring instructions live in `STARTUP_PROCESS.md`.

## 中文

### 安装方式

`golutra-mcp` 现在已经以 `golutra-mcp` 这个包名发布到 npm。

按普通 MCP Server 包安装即可：

```bash
npm install -g golutra-mcp
```

建议配合已安装的 Golutra 桌面应用直接运行。

macOS：

```bash
export GOLUTRA_CLI_PATH=/Applications/Golutra.app/Contents/MacOS/golutra-cli
export GOLUTRA_PROFILE=stable
export GOLUTRA_WORKSPACE_PATH=/absolute/path/to/workspace
golutra-mcp
```

Windows PowerShell：

```powershell
$env:GOLUTRA_CLI_PATH="C:\Users\<you>\AppData\Local\Programs\Golutra\golutra-cli.exe"
$env:GOLUTRA_PROFILE="stable"
$env:GOLUTRA_WORKSPACE_PATH="C:\absolute\path\to\workspace"
golutra-mcp
```

Linux：

```bash
export GOLUTRA_CLI_PATH=/usr/bin/golutra-cli
export GOLUTRA_PROFILE=stable
export GOLUTRA_WORKSPACE_PATH=/absolute/path/to/workspace
golutra-mcp
```

### 这是什么项目

`golutra-mcp` 是一个把 Golutra 能力暴露给 MCP 客户端的桥接层，底层通过 `golutra-cli` 与 Golutra 桌面端联通。

它不是 Golutra 本体，也不是对 Golutra 本地 IPC 协议的重写。这个仓库的职责，是把外部 MCP Host 和 Golutra 之间的集成边界收敛成一层更小、更稳定、更容易复用的适配层。

### 当前阶段是什么

当前这个项目已经进入“可下载安装的公开版本”阶段，并且第一版 npm 包已经发布。

现阶段已经具备：

- 基于 `stdio` 的 MCP Server 形态
- 基于 `golutra-cli` 的命令桥接
- chat、roadmap、context、diagnostics、skills 这些基础工具面
- 技能校验与项目 `SKILL.md` 直接读取能力，能覆盖本地技能开发链路
- 基本完整的开源项目骨架，包括贡献规范、安全策略、CI 和发布元数据

但它现在还不是一个“已经经过大规模真实场景验证、长期充分打磨”的成熟公共集成产品。更准确的定位是：一个已经可以下载安装、接入验证、试点使用的 Golutra MCP 集成层。

### 这个项目解决什么问题

这个项目的目标，是让支持 MCP 的宿主可以接入 Golutra，而不需要理解 Golutra 内部的本地 IPC 细节。

因此，这个仓库重点负责的是：

- 协议转换
- 运行时上下文管理
- 对现有 CLI 能力的稳定封装
- 联通诊断与集成体验

### 运行前提

这个 MCP Server 运行时依赖现有的 Golutra 本地运行环境：

- 本机已安装 Golutra 桌面应用
- 能访问到 `golutra-cli`
- 已知的有效工作区路径
- 本地已启动目标 profile 的 Golutra 桌面应用，通常使用 `stable`

按平台的默认 CLI 自动发现顺序：

- macOS：`/Applications/Golutra.app/Contents/MacOS/golutra-cli`，然后 `~/Applications/Golutra.app/Contents/MacOS/golutra-cli`，最后回退到 `PATH` 里的 `golutra-cli`
- Windows：`%LOCALAPPDATA%\Programs\Golutra\golutra-cli.exe`，然后 `%ProgramFiles%\Golutra\golutra-cli.exe`，再然后 `%ProgramFiles(x86)%\Golutra\golutra-cli.exe`，最后回退到 `PATH` 里的 `golutra-cli.exe`
- Linux：`~/.local/bin/golutra-cli`，然后 `~/.cargo/bin/golutra-cli`、`/usr/local/bin/golutra-cli`、`/usr/bin/golutra-cli`、`/opt/Golutra/golutra-cli`、`/app/bin/golutra-cli`，最后回退到 `PATH` 里的 `golutra-cli`

### 诊断能力

需要排查问题时，可以优先用 `golutra-diagnose` 区分：

- CLI 路径问题
- workspacePath 缺失或非法
- userId 缺失导致 app 探针跳过
- 桌面应用未运行或 profile 不匹配
- 普通 app 命令失败

更完整的诊断输出字段和常见 `reasonCode` 说明见 `docs/GOLUTRA_DIAGNOSE_EXAMPLES.md`。

### AI 看到这个项目后应该怎么做

如果一个 AI 系统或支持 MCP 的宿主看到这个仓库，推荐按下面方式接入：

1. 把 `golutra-mcp` 当作本地 `stdio` MCP Server 启动，不要把它当成 HTTP 服务。
2. 提供 `GOLUTRA_CLI_PATH`、`GOLUTRA_PROFILE`，通常还需要提供 `GOLUTRA_WORKSPACE_PATH`。
3. 先调用 `golutra-get-context` 或 `golutra-diagnose`，确认运行时上下文和联通状态。
4. 按现有工具面走标准调用链路，不要自造传输协议：
   `golutra-list-conversations` -> `golutra-list-messages` / `golutra-send-message` / `golutra-read-roadmap` / `golutra-update-roadmap`。
5. 把 `golutra-cli` 视为稳定边界。除非你明确准备长期维护另一套集成层，否则不要绕过这个项目去直连 Golutra 本地 socket IPC。

一句话概括：先诊断，再显式设置 workspace/profile，然后把 README 里提供的 MCP tools 当作正式集成契约来用。

### 后续规划

后续项目应该从“能桥接”继续推进到“更好用、可发布、可维护”。

比较明确的方向包括：

- 把当前偏透传的结果结构进一步做强类型化
- 增强 CLI / profile / workspace / app 状态诊断
- 在 tool 之外补充更完整的 MCP resources / prompts 能力
- 把打包、安装、发布链路收敛到更稳定的状态
- 补齐围绕真实 Golutra 协作场景的文档和示例
- 继续补强跨平台安装路径、自诊断、端到端兼容性验证

### 源码开发

如果你要按源码方式运行或参与开发：

```bash
npm install
export GOLUTRA_CLI_PATH=/absolute/path/to/golutra-cli
export GOLUTRA_PROFILE=stable
export GOLUTRA_WORKSPACE_PATH=/absolute/path/to/workspace
npm run dev
```

更完整的启动、验证与客户端接入说明见 `STARTUP_PROCESS.md`。

## Documentation

- Startup, installation, validation, and MCP client wiring:
  [STARTUP_PROCESS.md](./STARTUP_PROCESS.md)
- Diagnostic output examples and reason codes:
  [docs/GOLUTRA_DIAGNOSE_EXAMPLES.md](./docs/GOLUTRA_DIAGNOSE_EXAMPLES.md)
- Contribution guide:
  [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy:
  [SECURITY.md](./SECURITY.md)
- Change history:
  [CHANGELOG.md](./CHANGELOG.md)
- License:
  [LICENSE](./LICENSE)
