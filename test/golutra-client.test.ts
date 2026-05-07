import { describe, expect, it, vi } from "vitest";

import {
  buildCliGuideArgs,
  buildSkillValidateArgs,
  GolutraCliGateway,
  normalizeMentionIds
} from "../src/lib/golutra-client.js";
import type { CliJsonRunner } from "../src/lib/cli-runner.js";
import { CliExecutionError } from "../src/lib/errors.js";
import type { CliCommandRequest, StructuredCommandEnvelope } from "../src/lib/types.js";

describe("GolutraCliGateway", () => {
  it("builds a structured chat.send command", async () => {
    const executeJson = vi.fn<
      CliJsonRunner["executeJson"]
    >().mockResolvedValue({
      ok: true,
      requestId: "01TEST",
      result: {
        status: "ok",
        data: {
          messageId: "01MESSAGE"
        }
      }
    } satisfies StructuredCommandEnvelope);

    const gateway = new GolutraCliGateway({
      executeJson
    });

    await gateway.sendMessage(
      {
        cliPath: "golutra-cli",
        profile: "dev",
        workspacePath: "/workspace",
        timeoutMs: 10_000
      },
      {
        workspacePath: "/workspace",
        conversationId: "01CONV",
        senderId: "01SENDER",
        text: "hello",
        mentionIds: ["01TARGET"]
      }
    );

    expect(executeJson).toHaveBeenCalledTimes(1);
    const request = executeJson.mock.calls[0]?.[0] as CliCommandRequest;
    expect(request.cliPath).toBe("golutra-cli");
    expect(request.args[0]).toBe("--profile");
    expect(request.args[1]).toBe("dev");
    expect(request.args[2]).toBe("run");
    expect(request.args[3]).toBe("--command");
    expect(request.env).toEqual({
      GOLUTRA_CLI_HOST_KIND: "desktop"
    });
    expect(JSON.parse(request.args[4] ?? "{}")).toEqual({
      type: "chat.send",
      payload: {
        workspacePath: "/workspace",
        conversationId: "01CONV",
        senderId: "01SENDER",
        text: "hello",
        mentionIds: ["01TARGET"]
      }
    });
  });

  it("builds a project.members.config.list command", async () => {
    const executeJson = vi.fn<
      CliJsonRunner["executeJson"]
    >().mockResolvedValue({
      ok: true,
      result: {
        status: "ok",
        data: {
          members: [],
          conversationSummary: {
            channels: [],
            directs: []
          }
        }
      }
    } satisfies StructuredCommandEnvelope);

    const gateway = new GolutraCliGateway({
      executeJson
    });

    await gateway.listTeamConfig(
      {
        cliPath: "golutra-cli",
        timeoutMs: 10_000
      },
      {
        workspacePath: "/workspace"
      }
    );

    const request = executeJson.mock.calls[0]?.[0] as CliCommandRequest;
    expect(request.args.slice(0, 4)).toEqual([
      "--profile",
      "stable",
      "run",
      "--command"
    ]);
    expect(request.env).toEqual({
      GOLUTRA_CLI_HOST_KIND: "desktop"
    });
    expect(JSON.parse(request.args[4] ?? "{}")).toEqual({
      type: "project.members.config.list",
      payload: {
        workspacePath: "/workspace"
      }
    });
  });

  it("builds a project.member.name.update command", async () => {
    const executeJson = vi.fn<CliJsonRunner["executeJson"]>().mockResolvedValue({
      ok: true,
      result: {
        status: "ok",
        data: {
          memberId: "01MEMBER",
          name: "前端负责人"
        }
      }
    } satisfies StructuredCommandEnvelope);

    const gateway = new GolutraCliGateway({
      executeJson
    });

    await gateway.updateMemberName(
      {
        cliPath: "golutra-cli",
        profile: "stable",
        timeoutMs: 10_000
      },
      {
        workspacePath: "/workspace",
        memberId: "01MEMBER",
        name: "前端负责人"
      }
    );

    const request = executeJson.mock.calls[0]?.[0] as CliCommandRequest;
    expect(request.args.slice(0, 4)).toEqual([
      "--profile",
      "stable",
      "run",
      "--command"
    ]);
    expect(JSON.parse(request.args[4] ?? "{}")).toEqual({
      type: "project.member.name.update",
      payload: {
        workspacePath: "/workspace",
        memberId: "01MEMBER",
        name: "前端负责人"
      }
    });
  });

  it("falls back to the current team workspaceId when exporting a template workspace", async () => {
    const executeJson = vi
      .fn<CliJsonRunner["executeJson"]>()
      .mockResolvedValueOnce({
        ok: true,
        result: {
          status: "ok",
          data: {
            workspaceId: "workspace-01"
          }
        }
      } satisfies StructuredCommandEnvelope)
      .mockResolvedValueOnce({
        ok: true,
        result: {
          status: "ok",
          data: {
            templateDisplayName: "开发团队"
          }
        }
      } satisfies StructuredCommandEnvelope);

    const gateway = new GolutraCliGateway({
      executeJson
    });

    await gateway.exportFriendTemplateRepositoryWorkspace(
      {
        cliPath: "golutra-cli",
        timeoutMs: 10_000
      },
      {
        workspacePath: "/workspace",
        templateDisplayName: "开发团队",
        memberIds: ["01OWNER", "01MEMBER"],
        skillStorePackageBindingsByPath: {
          ".golutra/skills/frontend/SKILL.md": "pkg.frontend"
        },
        agentStorePackageBindingsByFolderName: {
          "quality-maintainer": "pkg.quality"
        },
        replaceInstalledPath: " /tmp/template.zip "
      }
    );

    expect(executeJson).toHaveBeenCalledTimes(2);

    const listRequest = executeJson.mock.calls[0]?.[0] as CliCommandRequest;
    expect(JSON.parse(listRequest.args[4] ?? "{}")).toEqual({
      type: "project.members.config.list",
      payload: {
        workspacePath: "/workspace"
      }
    });

    const exportRequest = executeJson.mock.calls[1]?.[0] as CliCommandRequest;
    expect(exportRequest.env).toEqual({
      GOLUTRA_CLI_HOST_KIND: "desktop"
    });
    expect(JSON.parse(exportRequest.args[4] ?? "{}")).toEqual({
      type: "friend-template.repository.export-workspace",
      payload: {
        workspaceId: "workspace-01",
        workspacePath: "/workspace",
        templateDisplayName: "开发团队",
        memberIds: ["01OWNER", "01MEMBER"],
        skillStorePackageBindingsByPath: {
          ".golutra/skills/frontend/SKILL.md": "pkg.frontend"
        },
        agentStorePackageBindingsByFolderName: {
          "quality-maintainer": "pkg.quality"
        },
        replaceInstalledPath: "/tmp/template.zip"
      }
    });
  });

  it("builds a friend-template.repository.publish-edited command", async () => {
    const executeJson = vi.fn<CliJsonRunner["executeJson"]>().mockResolvedValue({
      ok: true,
      result: {
        status: "ok",
        data: {
          fileName: "quality-maintainer"
        }
      }
    } satisfies StructuredCommandEnvelope);

    const gateway = new GolutraCliGateway({
      executeJson
    });

    await gateway.publishEditedFriendTemplateRepository(
      {
        cliPath: "golutra-cli",
        profile: "dev",
        timeoutMs: 10_000
      },
      {
        fileName: "quality-maintainer",
        targetFilePath: "/tmp/quality-maintainer.zip",
        terminalOverrides: [{ terminalType: "codex" }],
        projectSettings: {
          teamSize: 4
        },
        skillSourceWorkspacePath: " /workspace/source "
      }
    );

    const request = executeJson.mock.calls[0]?.[0] as CliCommandRequest;
    expect(request.args.slice(0, 4)).toEqual([
      "--profile",
      "dev",
      "run",
      "--command"
    ]);
    expect(JSON.parse(request.args[4] ?? "{}")).toEqual({
      type: "friend-template.repository.publish-edited",
      payload: {
        fileName: "quality-maintainer",
        targetFilePath: "/tmp/quality-maintainer.zip",
        terminalOverrides: [{ terminalType: "codex" }],
        projectSettings: {
          teamSize: 4
        },
        skillSourceWorkspacePath: "/workspace/source"
      }
    });
  });

  it("builds CLI guide commands", async () => {
    const executeText = vi.fn().mockResolvedValue("team guide");
    const gateway = new GolutraCliGateway({
      executeJson: vi.fn(),
      executeText
    });

    const result = await gateway.readCliGuide(
      {
        cliPath: "golutra-cli",
        profile: "dev",
        timeoutMs: 10_000
      },
      "team"
    );

    expect(result).toEqual({
      guide: "team",
      text: "team guide"
    });
    expect(executeText).toHaveBeenCalledWith({
      cliPath: "golutra-cli",
      args: ["--profile", "dev", "team"],
      env: {
        GOLUTRA_CLI_HOST_KIND: "desktop"
      },
      timeoutMs: 10_000
    });
    expect(buildCliGuideArgs("stable", "help")).toEqual([
      "--profile",
      "stable",
      "--help"
    ]);
  });

  it("normalizes mentionIds before building chat.send", async () => {
    const executeJson = vi.fn<
      CliJsonRunner["executeJson"]
    >().mockResolvedValue({
      ok: true,
      result: {
        status: "ok",
        data: {
          messageId: "01MESSAGE"
        }
      }
    } satisfies StructuredCommandEnvelope);

    const gateway = new GolutraCliGateway({
      executeJson
    });

    await gateway.sendMessage(
      {
        cliPath: "golutra-cli",
        timeoutMs: 10_000
      },
      {
        workspacePath: "/workspace",
        conversationId: "01CONV",
        senderId: "01SENDER",
        text: "hello",
        mentionIds: [" 01TARGET ", "01TARGET", "01ASSISTANT"]
      }
    );

    const request = executeJson.mock.calls[0]?.[0] as CliCommandRequest;
    expect(request.args.slice(0, 4)).toEqual([
      "--profile",
      "stable",
      "run",
      "--command"
    ]);
    expect(JSON.parse(request.args[4] ?? "{}")).toEqual({
      type: "chat.send",
      payload: {
        workspacePath: "/workspace",
        conversationId: "01CONV",
        senderId: "01SENDER",
        text: "hello",
        mentionIds: ["01TARGET", "01ASSISTANT"]
      }
    });
  });

  it("rejects mentionIds containing all before invoking the CLI", async () => {
    const executeJson = vi.fn<CliJsonRunner["executeJson"]>();
    const gateway = new GolutraCliGateway({
      executeJson
    });

    await expect(
      gateway.sendMessage(
        {
          cliPath: "golutra-cli",
          timeoutMs: 10_000
        },
        {
          workspacePath: "/workspace",
          conversationId: "01CONV",
          senderId: "01SENDER",
          text: "hello",
          mentionIds: ["all"]
        }
      )
    ).rejects.toThrow("mentionIds does not allow all");

    expect(executeJson).not.toHaveBeenCalled();
  });

  it("builds a skills command with workspace", async () => {
    const executeJson = vi.fn<CliJsonRunner["executeJson"]>().mockResolvedValue({
      skills: {}
    });

    const gateway = new GolutraCliGateway({
      executeJson
    });

    await gateway.listSkills(
      {
        cliPath: "golutra-cli",
        profile: "stable",
        timeoutMs: 10_000
      },
      {
        workspacePath: "/workspace"
      }
    );

    const request = executeJson.mock.calls[0]?.[0] as CliCommandRequest;
    expect(request.args).toEqual([
      "--profile",
      "stable",
      "skills",
      "--workspace",
      "/workspace"
    ]);
    expect(request.env).toEqual({
      GOLUTRA_CLI_HOST_KIND: "desktop"
    });
  });

  it("falls back from stable desktop to stable web when IPC is unreachable", async () => {
    const executeJson = vi
      .fn<CliJsonRunner["executeJson"]>()
      .mockRejectedValueOnce(
        new CliExecutionError({
          message:
            "failed to connect golutra ipc for profile `stable` host_kind=`desktop`",
          cliPath: "golutra-cli",
          args: ["--profile", "stable", "run"],
          exitCode: 1
        })
      )
      .mockResolvedValueOnce({
        ok: true,
        result: {
          status: "ok",
          data: {
            members: []
          }
        }
      } satisfies StructuredCommandEnvelope);

    const gateway = new GolutraCliGateway({
      executeJson
    });

    await gateway.listTeamConfig(
      {
        cliPath: "golutra-cli",
        timeoutMs: 10_000
      },
      {
        workspacePath: "/workspace"
      }
    );

    expect(executeJson).toHaveBeenCalledTimes(2);
    expect((executeJson.mock.calls[0]?.[0] as CliCommandRequest).env).toEqual({
      GOLUTRA_CLI_HOST_KIND: "desktop"
    });
    expect((executeJson.mock.calls[1]?.[0] as CliCommandRequest).args[1]).toBe(
      "stable"
    );
    expect((executeJson.mock.calls[1]?.[0] as CliCommandRequest).env).toEqual({
      GOLUTRA_CLI_HOST_KIND: "server"
    });
  });

  it("builds a skill-validate command", () => {
    expect(buildSkillValidateArgs("dev", "/workspace/skill-dir")).toEqual([
      "--profile",
      "dev",
      "skill-validate",
      "/workspace/skill-dir"
    ]);
  });

  it("rejects empty mentionIds after trimming", () => {
    expect(() => normalizeMentionIds([" ", "\n"])).toThrow(
      "mentionIds is required"
    );
  });
});
