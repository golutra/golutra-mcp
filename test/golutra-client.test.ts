import { describe, expect, it, vi } from "vitest";

import {
  buildSkillValidateArgs,
  GolutraCliGateway,
  normalizeMentionIds
} from "../src/lib/golutra-client.js";
import type { CliJsonRunner } from "../src/lib/cli-runner.js";
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
    expect(JSON.parse(request.args[2] ?? "{}")).toEqual({
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
