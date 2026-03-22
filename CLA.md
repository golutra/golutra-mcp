# golutra-mcp CLA Overview

`golutra-mcp` 当前按 [`Apache License 2.0`](./LICENSE) 分发。为了降低外部贡献的授权链风险，本仓库采用分层贡献协议：

1. 个人贡献者通过 [`ICLA`](./docs/legal/ICLA.md) 进行签署。
2. 代表公司、团队或其他组织提交贡献时，除个人签署 `ICLA` 外，还需要由有权签字人提供 [`CCLA`](./docs/legal/CCLA.md) 或等效书面授权。
3. 已批准的企业授权会登记在 [`corporate-authorizations.json`](./docs/legal/corporate-authorizations.json) 中，并在 PR 中通过授权编号引用；[`corporate-authorizations.md`](./docs/legal/corporate-authorizations.md) 用于说明维护规则。

## 为什么需要这套流程

- 即使仓库采用标准开源许可证，维护者仍需确认贡献者拥有完整授权，尤其是雇佣关系、第三方代码拷贝、AI 生成代码来源不清这些场景。
- 仅有“提了 PR”不足以说明贡献者拥有完整授权。
- 因此，本仓库要求在 PR 阶段明确贡献者身份、授权来源、第三方来源披露和 AI 辅助披露。

## 入站贡献模型

除 `ICLA` / `CCLA` 中约定的额外授权外，提交到本仓库并被接收的代码贡献，还应视为按 [`BSD-3-Clause`](./docs/legal/BSD-3-Clause.txt) 入站提交，不附加额外限制。

这样做的目的不是替代本仓库的项目许可证，而是降低未来在许可证兼容处理、下游分发和代码捐赠中的权利不确定性。

## 贡献前请阅读

- [`docs/legal/ICLA.md`](./docs/legal/ICLA.md)
- [`docs/legal/CCLA.md`](./docs/legal/CCLA.md)
- [`docs/legal/corporate-authorizations.json`](./docs/legal/corporate-authorizations.json)
- [`docs/legal/corporate-authorizations.md`](./docs/legal/corporate-authorizations.md)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)

被接收的贡献可能被用于仓库文档所述的 `Apache 2.0` 许可与分发模型，以及 [`CLA.md`](./CLA.md) 中说明的贡献协议安排。

如果你不能接受贡献按仓库文档所述的 `Apache 2.0` 分发模型和 [`CLA.md`](./CLA.md) 约定被使用，请不要向本仓库提交贡献。
