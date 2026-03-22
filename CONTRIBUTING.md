# Contributing

感谢你愿意为 `golutra-mcp` 提交贡献。

在提交任何贡献前，请先理解一件事：

- `golutra-mcp` 当前按 [`Apache License 2.0`](./LICENSE) 分发
- 被接收的贡献可能被用于仓库文档所述的 `Apache 2.0` 分发模型，以及 [`CLA.md`](./CLA.md) 中说明的贡献协议安排
- 如果你不能接受这些用途，请不要提交贡献

## 提交流程

1. Fork 仓库并创建你的功能分支。
2. 提交代码、测试或文档修改。
3. 发起 Pull Request。
4. 填写 PR 模板，如实声明你是个人贡献还是代表组织贡献，并披露第三方来源、AI 辅助情况和共同作者信息。
5. 第一次提交 PR 时，`CLA` 与 `PR Compliance` 工作流会自动运行。
6. 如果你还没有签署个人协议，机器人会在 PR 下留言并把 `CLA` 检查标记为失败。
7. 阅读 [`CLA.md`](./CLA.md) 和 [`docs/legal/ICLA.md`](./docs/legal/ICLA.md) 后，在 PR 评论区回复下面这句完整文本：

`I have read the ICLA and I hereby sign this agreement.`

8. 机器人记录签署后，`CLA` 检查会自动通过；如果没有自动刷新，再评论 `recheck`。
9. 如果你代表公司、团队或其他组织提交贡献，还需要先让有权签字人完成 [`docs/legal/CCLA.md`](./docs/legal/CCLA.md) 或等效书面授权，并在 PR 中填写已经登记的授权编号。

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

## 仓库维护者初始化要求

为了让 CLA 流程正常工作，仓库维护者还需要完成以下配置：

1. 在 GitHub 仓库设置中启用 Actions。
2. 推荐配置 GitHub App：
   - repository variable `CLA_APP_ID`
   - repository secret `CLA_APP_PRIVATE_KEY`
   如果暂时还没切 GitHub App，可临时保留仓库 secret `CLA_BOT_TOKEN` 作为兼容兜底。
3. 在默认分支保护规则里把 `CLA` 和 `PR Compliance` 两个检查都加入必过状态。
4. 额外创建一个未受保护的 `cla-signatures` 分支，专门存储 `.github/cla/signatures.json`。
5. 不要手动创建 `.github/cla/signatures.json`，首次有人签署时工作流会自动创建。
6. 如果收到企业贡献授权，先线下留档，再把授权编号登记到 [`docs/legal/corporate-authorizations.json`](./docs/legal/corporate-authorizations.json)。

创建 `cla-signatures` 分支的示例命令：

```bash
git switch --create cla-signatures
git commit --allow-empty -m "chore: initialize cla-signatures branch"
git push origin cla-signatures
git switch main
```

## Pull Requests

- Keep PRs focused on one logical change
- Update `README.md` and `CHANGELOG.md` when user-facing behavior changes
- Add or update tests when the change affects parsing, command mapping, or tool behavior
