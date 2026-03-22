import { describe, expect, it, vi } from "vitest";

import { ContextStore } from "../src/lib/context.js";
import { CliExecutionError } from "../src/lib/errors.js";
import { registerTools } from "../src/lib/toolkit.js";

class FakeMcpServer {
  readonly tools = new Map<string, (input: Record<string, unknown>) => unknown>();

  registerTool(
    name: string,
    _definition: unknown,
    handler: (input: Record<string, unknown>) => unknown
  ): void {
    this.tools.set(name, handler);
  }
}

describe("registerTools", () => {
  it("lets golutra-list-skills inherit the stored workspace context", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "golutra-cli",
      workspacePath: "/workspace",
      timeoutMs: 30_000
    });
    const listSkills = vi.fn().mockResolvedValue({
      skills: {},
      projectSkills: [
        {
          name: "alpha",
          targetPath: "/skills/alpha",
          skillMdPath: "/skills/alpha/SKILL.md",
          relativePath: ".golutra/skills/alpha/SKILL.md"
        }
      ]
    });

    registerTools(
      server as never,
      contextStore,
      {
        listSkills
      } as never
    );

    const handler = server.tools.get("golutra-list-skills");
    expect(handler).toBeTypeOf("function");

    const result = await handler?.({});

    expect(listSkills).toHaveBeenCalledWith(
      {
        cliPath: "golutra-cli",
        workspacePath: "/workspace",
        timeoutMs: 30_000
      },
      {
        workspacePath: "/workspace"
      }
    );
    expect(result).toMatchObject({
      structuredContent: {
        projectSkills: [
          {
            name: "alpha"
          }
        ]
      }
    });
  });

  it("uses a per-call workspace override without mutating stored defaults", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "golutra-cli",
      workspacePath: "/workspace-default",
      timeoutMs: 30_000
    });
    const listConversations = vi.fn().mockResolvedValue({
      channels: [],
      directs: []
    });

    registerTools(
      server as never,
      contextStore,
      {
        listConversations
      } as never
    );

    const handler = server.tools.get("golutra-list-conversations");
    expect(handler).toBeTypeOf("function");

    await handler?.({
      userId: "01USER",
      workspacePath: "/workspace-once"
    });

    expect(listConversations).toHaveBeenCalledWith(
      {
        cliPath: "golutra-cli",
        workspacePath: "/workspace-once",
        timeoutMs: 30_000
      },
      {
        workspacePath: "/workspace-once",
        userId: "01USER"
      }
    );
    expect(contextStore.getSnapshot()).toEqual({
      cliPath: "golutra-cli",
      workspacePath: "/workspace-default",
      timeoutMs: 30_000
    });
  });

  it("reports a missing explicit CLI path before running the CLI probe", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "/missing/golutra-cli",
      timeoutMs: 30_000
    });
    const listSkills = vi.fn();

    registerTools(
      server as never,
      contextStore,
      {
        listSkills
      } as never
    );

    const handler = server.tools.get("golutra-diagnose");
    const result = await handler?.({});

    expect(listSkills).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      structuredContent: {
        checks: {
          cliPath: {
            ok: false,
            reasonCode: "CLI_PATH_NOT_FOUND"
          },
          appConnection: {
            skipped: true,
            reasonCode: "APP_PROBE_SKIPPED"
          }
        },
        summary: {
          status: "error"
        }
      }
    });
  });

  it("marks the app probe as partial when workspacePath or userId is missing", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "golutra-cli",
      timeoutMs: 30_000
    });
    const listSkills = vi.fn().mockResolvedValue({
      skills: {
        chat: {
          description: "chat"
        }
      }
    });
    const listConversations = vi.fn();

    registerTools(
      server as never,
      contextStore,
      {
        listSkills,
        listConversations
      } as never
    );

    const handler = server.tools.get("golutra-diagnose");
    const result = await handler?.({});

    expect(listSkills).toHaveBeenCalledTimes(1);
    expect(listConversations).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      structuredContent: {
        checks: {
          cliCommand: {
            ok: true
          },
          workspace: {
            skipped: true,
            reasonCode: "WORKSPACE_PATH_MISSING"
          },
          appConnection: {
            skipped: true,
            reasonCode: "APP_PROBE_SKIPPED"
          }
        },
        summary: {
          status: "partial"
        }
      }
    });
  });

  it("classifies IPC connection failures as app not running or profile mismatch", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "golutra-cli",
      profile: "stable",
      workspacePath: "/tmp",
      timeoutMs: 30_000
    });
    const listSkills = vi.fn().mockResolvedValue({
      skills: {
        chat: {
          description: "chat"
        }
      }
    });
    const listConversations = vi.fn().mockRejectedValue(
      new CliExecutionError({
        message:
          "failed to connect golutra ipc for profile `stable`: /tmp/golutra-command.sock: No such file or directory",
        cliPath: "golutra-cli",
        args: ["--profile", "stable", "run"],
        exitCode: 1
      })
    );

    registerTools(
      server as never,
      contextStore,
      {
        listSkills,
        listConversations
      } as never
    );

    const handler = server.tools.get("golutra-diagnose");
    const result = await handler?.({
      userId: "01USER"
    });

    expect(result).toMatchObject({
      structuredContent: {
        checks: {
          appConnection: {
            ok: false,
            reasonCode: "APP_NOT_RUNNING_OR_PROFILE_MISMATCH",
            probe: "chat.conversations.list"
          }
        },
        summary: {
          status: "error"
        }
      }
    });
  });
});
