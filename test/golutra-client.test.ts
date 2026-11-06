import { describe, expect, it, vi } from "vitest";

import {
  buildCliGuideArgs,
  buildSkillValidateArgs,
  GolutraCliGateway
} from "../src/lib/golutra-client.js";
import type { CliJsonRunner } from "../src/lib/cli-runner.js";
import { CliExecutionError } from "../src/lib/errors.js";
import type { CliCommandRequest, StructuredCommandEnvelope } from "../src/lib/types.js";

describe("GolutraCliGateway", () => {
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
      "run",
      "--stdin",
      "--timeout-ms",
      "10000"
    ]);
    expect(request.env).toEqual({
      GOLUTRA_CLI_HOST_KIND: "auto"
    });
    expect(JSON.parse(request.stdin ?? "{}")).toEqual({
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
      "--stdin"
    ]);
    expect(JSON.parse(request.stdin ?? "{}")).toEqual({
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
    expect(JSON.parse(listRequest.stdin ?? "{}")).toEqual({
      type: "project.members.config.list",
      payload: {
        workspacePath: "/workspace"
      }
    });

    const exportRequest = executeJson.mock.calls[1]?.[0] as CliCommandRequest;
    expect(exportRequest.env).toEqual({
      GOLUTRA_CLI_HOST_KIND: "auto"
    });
    expect(JSON.parse(exportRequest.stdin ?? "{}")).toEqual({
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
      "--stdin"
    ]);
    expect(JSON.parse(request.stdin ?? "{}")).toEqual({
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
        GOLUTRA_CLI_HOST_KIND: "auto"
      },
      timeoutMs: 10_000
    });
    expect(buildCliGuideArgs("stable", "help")).toEqual([
      "--profile",
      "stable",
      "--help"
    ]);
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
      GOLUTRA_CLI_HOST_KIND: "auto"
    });
  });

  it.each(["COMMAND_IPC_UNAVAILABLE", "COMMAND_IPC_RESULT_UNCONFIRMED", "CLI_PROCESS_TIMEOUT"])("never replays a command after %s", async (code) => {
    const error = new CliExecutionError({ message: "transport failed", code, cliPath: "golutra-cli", args: ["run"], exitCode: 1 });
    const executeJson = vi.fn<CliJsonRunner["executeJson"]>().mockRejectedValue(error);
    const gateway = new GolutraCliGateway({ executeJson });
    await expect(gateway.listTeamConfig({ cliPath: "golutra-cli", timeoutMs: 10000 }, { workspacePath: "/workspace" })).rejects.toBe(error);
    expect(executeJson).toHaveBeenCalledTimes(1);
    expect((executeJson.mock.calls[0]?.[0] as CliCommandRequest).env).toEqual({ GOLUTRA_CLI_HOST_KIND: "auto" });
  });

  it("builds a skill-validate command", () => {
    expect(buildSkillValidateArgs("dev", "/workspace/skill-dir")).toEqual([
      "--profile",
      "dev",
      "skill-validate",
      "/workspace/skill-dir"
    ]);
  });

});
