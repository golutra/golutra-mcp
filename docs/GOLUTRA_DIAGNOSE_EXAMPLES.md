# golutra-diagnose Examples

`golutra-diagnose` is the MCP-side diagnostic tool for separating CLI, workspace, identity, and app connectivity failures.

`golutra-diagnose` 是这个仓库里专门用来区分 CLI、工作区、身份参数和桌面应用联通问题的诊断工具。

## English

### Output Shape

Typical output:

```json
{
  "context": {
    "cliPath": "/Applications/Golutra.app/Contents/MacOS/golutra-cli",
    "profile": "stable",
    "workspacePath": "/absolute/path/to/workspace",
    "timeoutMs": 30000
  },
  "checks": {
    "cliPath": {
      "ok": true,
      "source": "explicit-path"
    },
    "cliCommand": {
      "ok": true,
      "command": "skills",
      "builtInSkillNames": ["chat", "golutra-cli", "roadmap"]
    },
    "workspace": {
      "ok": true,
      "workspacePath": "/absolute/path/to/workspace"
    },
    "userId": {
      "ok": true,
      "userId": "01USER"
    },
    "appConnection": {
      "ok": false,
      "probe": "chat.conversations.list",
      "reasonCode": "APP_NOT_RUNNING_OR_PROFILE_MISMATCH",
      "message": "Golutra desktop app for profile stable is not reachable through local IPC."
    }
  },
  "summary": {
    "ok": false,
    "status": "error",
    "reasonCodes": ["APP_NOT_RUNNING_OR_PROFILE_MISMATCH"]
  },
  "nextSteps": [
    "Start the Golutra desktop app with profile stable, then retry the diagnostic.",
    "If another profile is currently running, update GOLUTRA_PROFILE or golutra-set-context to the correct profile."
  ]
}
```

### Meaning Of Each Check

- `cliPath`: whether the resolved CLI path exists and whether it came from an explicit path or PATH lookup
- `cliCommand`: whether the basic CLI probe succeeded
- `workspace`: whether `workspacePath` exists and is a directory
- `userId`: whether an app-backed probe has enough identity input
- `appConnection`: whether `chat.conversations.list` can reach the running Golutra desktop app

If you pass `workspacePath` directly to `golutra-diagnose`, `context.workspacePath` reflects that one call only and does not mutate the stored default context.

### Common Reason Codes

- `CLI_PATH_NOT_FOUND`: `GOLUTRA_CLI_PATH` points to a file that does not exist
- `CLI_NOT_FOUND`: no runnable `golutra-cli` could be started from the resolved path or PATH
- `CLI_TIMEOUT`: `golutra-cli` did not respond before the configured timeout
- `CLI_PROTOCOL_ERROR`: `golutra-cli` returned non-JSON or malformed JSON output
- `WORKSPACE_PATH_MISSING`: no workspace path was provided for app-backed diagnostics
- `WORKSPACE_PATH_NOT_FOUND`: the provided workspace path does not exist
- `WORKSPACE_PATH_NOT_DIRECTORY`: the provided workspace path exists but is not a directory
- `USER_ID_MISSING`: no `userId` was provided for the app-backed conversation probe
- `APP_NOT_RUNNING_OR_PROFILE_MISMATCH`: the desktop app is not reachable on the expected local IPC endpoint, or the selected profile is wrong
- `APP_COMMAND_FAILED`: CLI reached the desktop app probe stage, but the app-backed command still failed for another reason
- `APP_PROBE_SKIPPED`: app probe was intentionally skipped because an earlier prerequisite check did not pass

### Typical Failure Patterns

1. CLI path misconfigured

```json
{
  "checks": {
    "cliPath": {
      "ok": false,
      "reasonCode": "CLI_PATH_NOT_FOUND"
    },
    "appConnection": {
      "ok": false,
      "skipped": true,
      "reasonCode": "APP_PROBE_SKIPPED"
    }
  }
}
```

2. Workspace missing

```json
{
  "checks": {
    "cliCommand": {
      "ok": true
    },
    "workspace": {
      "ok": false,
      "skipped": true,
      "reasonCode": "WORKSPACE_PATH_MISSING"
    },
    "appConnection": {
      "ok": false,
      "skipped": true,
      "reasonCode": "APP_PROBE_SKIPPED"
    }
  },
  "summary": {
    "status": "partial"
  }
}
```

3. App not running or profile mismatch

```json
{
  "checks": {
    "appConnection": {
      "ok": false,
      "probe": "chat.conversations.list",
      "reasonCode": "APP_NOT_RUNNING_OR_PROFILE_MISMATCH"
    }
  },
  "nextSteps": [
    "Start the Golutra desktop app with profile stable, then retry the diagnostic."
  ]
}
```

## 中文

### 输出结构

`golutra-diagnose` 现在会稳定返回这几部分：

- `context`：本次诊断实际使用的 `cliPath / profile / workspacePath / timeoutMs`
- `checks.cliPath`：CLI 路径是否存在，以及是显式路径还是 PATH 命令名
- `checks.cliCommand`：CLI 级探针是否通过
- `checks.workspace`：工作区路径是否存在、是否为目录
- `checks.userId`：是否具备 app 级探针所需的 `userId`
- `checks.appConnection`：`chat.conversations.list` 是否能打通桌面应用
- `summary`：整体诊断状态
- `nextSteps`：下一步建议动作

如果你是在这次 `golutra-diagnose` 调用里临时传入 `workspacePath`，那么 `context.workspacePath` 反映的是本次调用实际使用的值，不会回写默认上下文。

### 常见 Reason Code

- `CLI_PATH_NOT_FOUND`：`GOLUTRA_CLI_PATH` 指向了不存在的文件
- `CLI_NOT_FOUND`：解析出的 `golutra-cli` 无法启动
- `CLI_TIMEOUT`：CLI 在超时时间内没有返回
- `CLI_PROTOCOL_ERROR`：CLI 返回了非 JSON 或损坏的 JSON
- `WORKSPACE_PATH_MISSING`：没有提供 app 级诊断所需的工作区路径
- `WORKSPACE_PATH_NOT_FOUND`：工作区路径不存在
- `WORKSPACE_PATH_NOT_DIRECTORY`：工作区路径存在，但不是目录
- `USER_ID_MISSING`：没有提供 app 级探针需要的 `userId`
- `APP_NOT_RUNNING_OR_PROFILE_MISMATCH`：桌面应用未运行，或者当前 profile 配错了
- `APP_COMMAND_FAILED`：已经进入 app 级探针，但业务命令还是失败了
- `APP_PROBE_SKIPPED`：因为前置条件没过，app 探针被跳过了

### 典型排障场景

1. CLI 路径配置错

- 现象：`checks.cliPath.reasonCode = CLI_PATH_NOT_FOUND`
- 处理：修正 `GOLUTRA_CLI_PATH`，或者确认 `golutra-cli` 已进入 PATH

2. 没传 `workspacePath`

- 现象：`checks.workspace.reasonCode = WORKSPACE_PATH_MISSING`
- 处理：在 tool 调用里传 `workspacePath`，或者先执行 `golutra-set-context`

3. 桌面应用没启动或 profile 配错

- 现象：`checks.appConnection.reasonCode = APP_NOT_RUNNING_OR_PROFILE_MISMATCH`
- 处理：启动对应 profile 的 Golutra 桌面应用，或者把 `GOLUTRA_PROFILE` / `golutra-set-context` 调整成正确 profile

4. app 级命令失败，但不是 IPC 不通

- 现象：`checks.appConnection.reasonCode = APP_COMMAND_FAILED`
- 处理：重点检查 `workspacePath` 是否对应当前打开的工作区，以及 `userId` 是否属于该工作区
