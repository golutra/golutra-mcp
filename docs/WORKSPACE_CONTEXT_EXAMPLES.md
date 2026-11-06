# Workspace Context Examples

This document explains how `workspacePath` behaves in `golutra-mcp`.

本文档用于说明 `golutra-mcp` 里 `workspacePath` 的实际行为。

## Core Rule

- Passing `workspacePath` in a tool call only affects that one call
- `golutra-set-context` is the explicit way to persist a new default workspace
- 在业务 tool 调用里传 `workspacePath`，只影响本次调用
- `golutra-set-context` 才会把新的工作区写成后续调用的默认值

## Example 1: Use The Stored Default Workspace

First, persist a default workspace:

先设置默认工作区：

Tool:

`golutra-set-context`

Input:

```json
{
  "workspacePath": "/workspace-a",
  "profile": "stable"
}
```

Then check the stored context:

然后读取当前默认上下文：

Tool:

`golutra-get-context`

Expected result:

```json
{
  "workspacePath": "/workspace-a",
  "profile": "stable"
}
```

After that, any workspace-dependent tool call without an explicit `workspacePath` will use `/workspace-a`.

之后，所有没有显式传 `workspacePath` 的工作区相关 tool，都会默认使用 `/workspace-a`。

## Example 2: Override Workspace For One Call Only

Assume the stored default is still `/workspace-a`.

假设当前默认工作区仍然是 `/workspace-a`。

Now make a one-time override:

现在做一次临时覆盖：

Tool:

`golutra-list-conversations`

Input:

```json
{
  "workspacePath": "/workspace-b",
  "userId": "01USER"
}
```

This call uses `/workspace-b`.

这次调用会使用 `/workspace-b`。

But if you immediately read the stored context again:

但如果你随后再次读取默认上下文：

Tool:

`golutra-get-context`

Expected result:

```json
{
  "workspacePath": "/workspace-a",
  "profile": "stable"
}
```

That means the one-time override did not mutate the stored default workspace.

这表示临时覆盖没有污染默认工作区缓存。

## Example 3: Persist A New Default Workspace

If you want later calls to use `/workspace-b` by default, update the stored context explicitly.

如果你希望后续调用默认都切到 `/workspace-b`，就要显式更新默认上下文。

Tool:

`golutra-set-context`

Input:

```json
{
  "workspacePath": "/workspace-b"
}
```

Then read the context again:

然后再次读取上下文：

Tool:

`golutra-get-context`

Expected result:

```json
{
  "workspacePath": "/workspace-b",
  "profile": "stable"
}
```

This time the default really changed for later calls.

这一次，后续调用的默认工作区才真正变成了 `/workspace-b`。

## Recommended Usage

- For a one-off workspace switch, pass `workspacePath` directly in that tool call
- For a durable workspace switch, use `golutra-set-context`
- For multi-workspace AI hosts, prefer explicit per-call `workspacePath` instead of frequently mutating shared defaults
- 单次切换工作区：直接在该次 tool 调用里传 `workspacePath`
- 持久切换默认工作区：使用 `golutra-set-context`
- 多工作区 AI 宿主：优先按调用显式传 `workspacePath`，不要频繁改共享默认值

## Recommended Tool Sequence

Use this order when integrating a new AI host or when troubleshooting a new workspace.

当你接入一个新的 AI 宿主，或者第一次接一个新的工作区时，推荐按这个顺序调用。

### Step 1: Read The Current Stored Context

Tool:

`golutra-get-context`

Purpose:

- Confirm the currently stored `cliPath`, `profile`, `workspacePath`, and `timeoutMs`
- 确认当前默认缓存里的 `cliPath`、`profile`、`workspacePath` 和 `timeoutMs`

### Step 2: Diagnose The Runtime

Tool:

`golutra-diagnose`

Typical input:

```json
{
  "workspacePath": "/workspace-a"
}
```

Purpose:

- Verify that `golutra-cli` can run
- Verify that `workspacePath` is valid
- Verify that the Golutra desktop app for the selected profile is reachable
- 验证 `golutra-cli` 是否可执行
- 验证 `workspacePath` 是否有效
- 验证当前 profile 对应的 Golutra 桌面应用是否可达

### Step 3: Read The Team Overview

Tool:

`golutra-read-team-config`

Purpose:

- Read member config summaries
- Read `conversationSummary` for default channel, channels, and direct conversations
- 读取成员配置摘要
- 读取 `conversationSummary`，包含默认频道、频道和私聊

### Step 4: Call Workspace Tools

After diagnosis passes, continue with normal business tools.

诊断通过后，再进入正常业务 tool 调用。

Typical examples:

- `golutra-read-team-config`
- `golutra-list-terminal-defaults`
- `golutra-create-terminals`
- `golutra-create-channel`
- `golutra-ensure-direct`
- `golutra-read-prompt-tokens`
- `golutra-update-member-prompt-settings`
- `golutra-update-member-binding`
- `golutra-update-member-automation`
- `golutra-list-conversations`
- `golutra-list-messages`
- `golutra-send-messages` (only member-send entry, for one or many messages)
- `golutra-read-inbox`
- `golutra-read-roadmap`
- `golutra-update-roadmap`

### Step 5: Decide Whether The Workspace Switch Is Temporary

- If this workspace change is only for one request, keep passing `workspacePath` on that request
- If later calls should all use the new workspace, call `golutra-set-context`
- 如果只是一次性切换，继续在该次调用里传 `workspacePath`
- 如果之后都要默认切过去，再调用 `golutra-set-context`

## Practical Rule Of Thumb

- Diagnose first
- Keep `workspacePath` explicit when switching workspaces
- Persist defaults only when you really want later calls to inherit them
- 先诊断
- 切换工作区时保持 `workspacePath` 显式
- 只有明确要影响后续调用时，才持久化默认值

## Example 4: Real Chat Flow

Use this flow when an AI host needs to enter a workspace, inspect recent context, and then send a message.

当一个 AI 宿主需要进入某个工作区、读取最近上下文、然后发送消息时，可以直接按这条链路调用。

### Step 1: Diagnose The Target Workspace

Tool:

`golutra-diagnose`

Input:

```json
{
  "workspacePath": "/workspace-a",
  "userId": "01USER"
}
```

Goal:

- Confirm `golutra-cli` is reachable
- Confirm `/workspace-a` is valid
- Confirm the Golutra desktop app can answer workspace-scoped commands
- 确认 `golutra-cli` 可达
- 确认 `/workspace-a` 是有效工作区
- 确认 Golutra 桌面应用可以响应该工作区的命令

### Step 2: List Conversations

Tool:

`golutra-list-conversations`

Input:

```json
{
  "workspacePath": "/workspace-a",
  "userId": "01USER"
}
```

Typical result:

```json
{
  "channels": [
    {
      "id": "01CHANNEL",
      "name": "general"
    }
  ],
  "directs": [],
  "defaultChannelId": "01CHANNEL"
}
```

Goal:

- Find the target `conversationId`
- 找到接下来要读取和发送消息的 `conversationId`

### Step 3: Read Recent Messages

Tool:

`golutra-list-messages`

Input:

```json
{
  "workspacePath": "/workspace-a",
  "conversationId": "01CHANNEL",
  "limit": 20
}
```

Goal:

- Inspect recent chat history before replying
- 在发送消息前先读取最近上下文

### Step 4: Send A Message

Tool:

`golutra-send-messages`

Input:

```json
{
  "workspacePath": "/workspace-a",
  "senderId": "01USER",
  "requestId": "status-single-001",
  "messages": [{
    "key": "status",
    "to": { "conversationId": "01CHANNEL", "mentionIds": ["01ASSISTANT"] },
    "text": "Please summarize the latest task status."
  }]
}
```

Goal:

- Send a structured `chat.send.batch` request through `golutra-cli`
- 通过 `golutra-cli` 发送结构化 `chat.send.batch` 请求

### Notes

- If `/workspace-a` is only needed for this request, keep passing it explicitly and do not call `golutra-set-context`
- If later calls should also stay on `/workspace-a`, you can persist it once with `golutra-set-context`
- `mentionIds` must be explicit and cannot contain `all`
- 如果 `/workspace-a` 只是本次临时使用，就继续显式传参，不要调用 `golutra-set-context`
- 如果后续也都要固定用 `/workspace-a`，可以先用一次 `golutra-set-context` 持久化
- `mentionIds` 必须显式给出，而且不能包含 `all`

## Example 5: Batch Private Messages, Channel Messages And Replies

Use `golutra-send-messages` for every member send, including single messages. A single call submits all items to the selected Host; `queued` means accepted into the member queue, not that a model has finished replying.

成员发送统一使用 `golutra-send-messages`，单条同样使用 messages 数组，一次提交私聊、群聊和回复。`queued` 表示已进入成员队列，不表示模型已经完成回复。

Tool: `golutra-send-messages`

```json
{
  "workspacePath": "/workspace-a",
  "senderId": "01USER",
  "requestId": "status-round-001",
  "messages": [
    {
      "key": "notify-a",
      "to": { "memberId": "01ASSISTANT" },
      "text": "Please summarize your latest task status."
    },
    {
      "key": "channel-update",
      "to": { "conversationId": "01CHANNEL", "mentionIds": ["01ASSISTANT"] },
      "text": "Please review the current plan."
    },
    {
      "key": "answer-original",
      "replyTo": "01SOURCE_MESSAGE",
      "text": "The requested verification is complete."
    }
  ]
}
```

- Supply exactly one destination per item: `to.memberId`, `to.conversationId` with explicit `mentionIds`, or `replyTo`. Use the actual source message ID for replies.
- Check `items[].status` even when the batch was accepted. A partial failure preserves successes. Retry an unchanged failed or uncertain item with the same `requestId` and `key`; changed text or destination needs a new key.
- Verified member processes may omit `senderId` and `workspacePath` for Host inference. An external local operator must supply them; supplying an ID does not bypass identity checks or grant inbox access.
- When a member receives `GOLUTRA_INBOX`, use `golutra-read-inbox` with its `batchId`, starting at `cursor: 0`, then follow `nextCursor` until `complete: true`. Reply using the original message IDs.
- 每条只能指定一种目的地；`replyTo` 使用收到的原消息 ID，不使用会话 ID。
- 必须检查逐项结果。重试内容未变的失败/不确定项时保持 `requestId + key` 不变；修改正文或目的地后使用新 key，避免幂等冲突。
- 可信成员进程可由 Host 推断身份与工作区；外部本机操作员应显式传入。声明 senderId 不能绕过身份校验或取得成员收件箱权限。
- 收到 `GOLUTRA_INBOX` 时，从 cursor 0 读取该 batchId 的完整分页，直到 complete，再按原消息 ID 回复。
