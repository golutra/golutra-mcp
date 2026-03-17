# golutra-mcp

`golutra-mcp` is an MCP bridge project for Golutra.

`golutra-mcp` 是一个面向 Golutra 的 MCP 桥接项目。

## English

### Install

`golutra-mcp` is now published on npm as `golutra-mcp@0.1.0`.

Install it as a normal MCP server package:

```bash
npm install -g golutra-mcp
```

Run it with a published Golutra desktop installation:

```bash
export GOLUTRA_CLI_PATH=/Applications/Golutra.app/Contents/MacOS/golutra-cli
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
- a reachable `golutra-cli` binary, usually `/Applications/Golutra.app/Contents/MacOS/golutra-cli`
- a valid Golutra workspace path
- the target Golutra desktop app profile running locally, usually `stable`

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

Detailed startup, validation, and client wiring instructions live in `startup_processmd.md`.

## 中文

### 安装方式

`golutra-mcp` 现在已经以 `golutra-mcp@0.1.0` 发布到 npm。

按普通 MCP Server 包安装即可：

```bash
npm install -g golutra-mcp
```

建议配合已安装的 Golutra 桌面应用直接运行：

```bash
export GOLUTRA_CLI_PATH=/Applications/Golutra.app/Contents/MacOS/golutra-cli
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
- 能访问到 `golutra-cli`，通常路径是 `/Applications/Golutra.app/Contents/MacOS/golutra-cli`
- 已知的有效工作区路径
- 本地已启动目标 profile 的 Golutra 桌面应用，通常使用 `stable`

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

更完整的启动、验证与客户端接入说明见 `startup_processmd.md`。

## Documentation

- Startup, installation, validation, and MCP client wiring:
  [startup_processmd.md](./startup_processmd.md)
- Contribution guide:
  [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy:
  [SECURITY.md](./SECURITY.md)
- Change history:
  [CHANGELOG.md](./CHANGELOG.md)
- License:
  [LICENSE](./LICENSE)
