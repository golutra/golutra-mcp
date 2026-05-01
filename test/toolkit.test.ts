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
    const listTeamConfig = vi.fn();

    registerTools(
      server as never,
      contextStore,
      {
        listSkills,
        listTeamConfig
      } as never
    );

    const handler = server.tools.get("golutra-diagnose");
    const result = await handler?.({});

    expect(listSkills).toHaveBeenCalledTimes(1);
    expect(listTeamConfig).not.toHaveBeenCalled();
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
    const listTeamConfig = vi.fn().mockRejectedValue(
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
        listTeamConfig
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
            probe: "project.members.config.list"
          }
        },
        summary: {
          status: "error"
        }
      }
    });
  });

  it("exposes project members config as the team overview tool", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "golutra-cli",
      workspacePath: "/workspace",
      timeoutMs: 30_000
    });
    const listTeamConfig = vi.fn().mockResolvedValue({
      members: [],
      conversationSummary: {
        channels: [],
        directs: []
      }
    });

    registerTools(
      server as never,
      contextStore,
      {
        listTeamConfig
      } as never
    );

    const handler = server.tools.get("golutra-read-team-config");
    const result = await handler?.({});

    expect(listTeamConfig).toHaveBeenCalledWith(
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
        conversationSummary: {
          channels: [],
          directs: []
        }
      }
    });
  });

  it("exposes top-level CLI guides as readable text", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "golutra-cli",
      profile: "dev",
      timeoutMs: 30_000
    });
    const readCliGuide = vi.fn().mockResolvedValue({
      guide: "team",
      text: "golutra-cli team"
    });

    registerTools(
      server as never,
      contextStore,
      {
        readCliGuide
      } as never
    );

    const handler = server.tools.get("golutra-read-cli-guide");
    const result = await handler?.({
      guide: "team"
    });

    expect(readCliGuide).toHaveBeenCalledWith(
      {
        cliPath: "golutra-cli",
        profile: "dev",
        timeoutMs: 30_000
      },
      "team"
    );
    expect(result).toMatchObject({
      content: [
        {
          type: "text",
          text: "golutra-cli team"
        }
      ],
      structuredContent: {
        guide: "team",
        text: "golutra-cli team"
      }
    });
  });

  it("requires memberName when deleting a project member", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "golutra-cli",
      workspacePath: "/workspace",
      timeoutMs: 30_000
    });
    const deleteMember = vi.fn().mockResolvedValue({
      memberId: "01MEMBER"
    });

    registerTools(
      server as never,
      contextStore,
      {
        deleteMember
      } as never
    );

    const handler = server.tools.get("golutra-delete-member");
    const result = await handler?.({
      memberId: "01MEMBER",
      memberName: "Backend",
      confirmedMemberId: "01MEMBER",
      confirmedMemberName: "Backend"
    });

    expect(deleteMember).toHaveBeenCalledWith(
      {
        cliPath: "golutra-cli",
        workspacePath: "/workspace",
        timeoutMs: 30_000
      },
      {
        workspacePath: "/workspace",
        memberId: "01MEMBER"
      }
    );
    expect(result).toMatchObject({
      structuredContent: {
        memberId: "01MEMBER"
      }
    });
  });

  it("rejects destructive member deletion when confirmation mismatches", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "golutra-cli",
      workspacePath: "/workspace",
      timeoutMs: 30_000
    });
    const deleteMember = vi.fn();

    registerTools(
      server as never,
      contextStore,
      {
        deleteMember
      } as never
    );

    const handler = server.tools.get("golutra-delete-member");
    const result = await handler?.({
      memberId: "01MEMBER",
      memberName: "Backend",
      confirmedMemberId: "01OTHER",
      confirmedMemberName: "Backend"
    });

    expect(deleteMember).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        message: "memberId confirmation mismatch"
      }
    });
  });

  it("requires conversation id confirmation before deleting a conversation", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "golutra-cli",
      workspacePath: "/workspace",
      timeoutMs: 30_000
    });
    const deleteConversation = vi.fn().mockResolvedValue({
      conversationId: "01CONV"
    });

    registerTools(
      server as never,
      contextStore,
      {
        deleteConversation
      } as never
    );

    const handler = server.tools.get("golutra-delete-conversation");
    const result = await handler?.({
      conversationId: "01CONV",
      confirmedConversationId: "01CONV"
    });

    expect(deleteConversation).toHaveBeenCalledWith(
      {
        cliPath: "golutra-cli",
        workspacePath: "/workspace",
        timeoutMs: 30_000
      },
      {
        workspacePath: "/workspace",
        conversationId: "01CONV"
      }
    );
    expect(result).toMatchObject({
      structuredContent: {
        conversationId: "01CONV"
      }
    });
  });

  it("requires member confirmation before restarting a member terminal", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "golutra-cli",
      workspacePath: "/workspace",
      timeoutMs: 30_000
    });
    const restartMember = vi.fn().mockResolvedValue({
      memberId: "01MEMBER"
    });

    registerTools(
      server as never,
      contextStore,
      {
        restartMember
      } as never
    );

    const handler = server.tools.get("golutra-restart-member");
    const result = await handler?.({
      memberId: "01MEMBER",
      memberName: "Backend",
      confirmedMemberId: "01MEMBER",
      confirmedMemberName: "Backend",
      launchReason: "prompt-reset"
    });

    expect(restartMember).toHaveBeenCalledWith(
      {
        cliPath: "golutra-cli",
        workspacePath: "/workspace",
        timeoutMs: 30_000
      },
      {
        workspacePath: "/workspace",
        memberId: "01MEMBER",
        launchReason: "prompt-reset"
      }
    );
    expect(result).toMatchObject({
      structuredContent: {
        memberId: "01MEMBER"
      }
    });
  });
});
