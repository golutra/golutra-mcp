import type { CliJsonRunner } from "./cli-runner.js";
import { CliExecutionError } from "./errors.js";
import type {
  ChatConversationsListData,
  ChatMessagesListData,
  ChatSendData,
  CommandContextInput,
  ListSkillsResponse,
  RoadmapResultData,
  RuntimeContextSnapshot,
  SkillValidationResult,
  StructuredCommand,
  StructuredCommandEnvelope
} from "./types.js";

function buildProfileArgs(profile: RuntimeContextSnapshot["profile"]): string[] {
  return profile ? ["--profile", profile] : [];
}

function buildStructuredRunArgs(
  profile: RuntimeContextSnapshot["profile"],
  command: StructuredCommand
): string[] {
  return [
    ...buildProfileArgs(profile),
    "run",
    "--command",
    JSON.stringify(command)
  ];
}

function buildSkillsArgs(
  profile: RuntimeContextSnapshot["profile"],
  options: { skillName?: string | undefined; workspacePath?: string | undefined }
): string[] {
  const args = [...buildProfileArgs(profile), "skills"];
  if (options.workspacePath) {
    args.push("--workspace", options.workspacePath);
  }
  if (options.skillName) {
    args.push(options.skillName);
  }
  return args;
}

function buildSkillValidateArgs(
  profile: RuntimeContextSnapshot["profile"],
  skillPath: string
): string[] {
  return [...buildProfileArgs(profile), "skill-validate", skillPath];
}

export class GolutraCliGateway {
  constructor(private readonly runner: CliJsonRunner) {}

  private async executeStructured<T>(
    command: StructuredCommand,
    runtimeContext: RuntimeContextSnapshot
  ): Promise<T> {
    const response = await this.runner.executeJson<StructuredCommandEnvelope>({
      cliPath: runtimeContext.cliPath,
      args: buildStructuredRunArgs(runtimeContext.profile, command),
      timeoutMs: runtimeContext.timeoutMs
    });

    if (!response.ok || response.result?.status !== "ok") {
      throw new CliExecutionError({
        message:
          response.error ??
          response.result?.message ??
          "golutra-cli returned an unsuccessful command result",
        cliPath: runtimeContext.cliPath,
        args: buildStructuredRunArgs(runtimeContext.profile, command),
        exitCode: 1
      });
    }

    return (response.result?.data ?? {}) as T;
  }

  async listConversations(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string; userId: string }
  ): Promise<ChatConversationsListData> {
    return this.executeStructured<ChatConversationsListData>(
      {
        type: "chat.conversations.list",
        payload: {
          workspacePath: input.workspacePath,
          userId: input.userId
        }
      },
      runtimeContext
    );
  }

  async listMessages(
    runtimeContext: RuntimeContextSnapshot,
    input: {
      workspacePath: string;
      conversationId: string;
      limit?: number | undefined;
      beforeId?: string | undefined;
    }
  ): Promise<ChatMessagesListData> {
    const payload: StructuredCommand = {
      type: "chat.messages.list",
      payload: {
        workspacePath: input.workspacePath,
        conversationId: input.conversationId,
        ...(typeof input.limit === "number" ? { limit: input.limit } : {}),
        ...(input.beforeId ? { beforeId: input.beforeId } : {})
      }
    };

    return this.executeStructured<ChatMessagesListData>(
      payload,
      runtimeContext
    );
  }

  async sendMessage(
    runtimeContext: RuntimeContextSnapshot,
    input: {
      workspacePath: string;
      conversationId: string;
      senderId: string;
      text: string;
      mentionIds: string[];
    }
  ): Promise<ChatSendData> {
    return this.executeStructured<ChatSendData>(
      {
        type: "chat.send",
        payload: {
          workspacePath: input.workspacePath,
          conversationId: input.conversationId,
          senderId: input.senderId,
          text: input.text,
          mentionIds: input.mentionIds
        }
      },
      runtimeContext
    );
  }

  async readRoadmap(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string; conversationId?: string | undefined }
  ): Promise<RoadmapResultData> {
    const payload: StructuredCommand = {
      type: "roadmap.read",
      payload: {
        workspacePath: input.workspacePath,
        ...(input.conversationId ? { conversationId: input.conversationId } : {})
      }
    };

    return this.executeStructured<RoadmapResultData>(
      payload,
      runtimeContext
    );
  }

  async updateRoadmap(
    runtimeContext: RuntimeContextSnapshot,
    input: {
      workspacePath: string;
      conversationId?: string | undefined;
      readOnly?: boolean | undefined;
      roadmap: {
        objective: string;
        tasks: Array<{
          id: number;
          number?: string | undefined;
          title: string;
          status: "pending" | "in-progress" | "done";
          pinned?: boolean | undefined;
        }>;
      };
    }
  ): Promise<RoadmapResultData> {
    const payload: StructuredCommand = {
      type: "roadmap.update",
      payload: {
        workspacePath: input.workspacePath,
        ...(input.conversationId ? { conversationId: input.conversationId } : {}),
        ...(typeof input.readOnly === "boolean" ? { readOnly: input.readOnly } : {}),
        roadmap: input.roadmap
      }
    };

    return this.executeStructured<RoadmapResultData>(
      payload,
      runtimeContext
    );
  }

  async listSkills(
    runtimeContext: RuntimeContextSnapshot,
    input: Pick<CommandContextInput, "workspacePath">
  ): Promise<ListSkillsResponse> {
    return this.runner.executeJson<ListSkillsResponse>({
      cliPath: runtimeContext.cliPath,
      args: buildSkillsArgs(runtimeContext.profile, {
        ...(input.workspacePath ? { workspacePath: input.workspacePath } : {})
      }),
      timeoutMs: runtimeContext.timeoutMs
    });
  }

  async getSkill(
    runtimeContext: RuntimeContextSnapshot,
    skillName: string
  ): Promise<Record<string, unknown>> {
    return this.runner.executeJson<Record<string, unknown>>({
      cliPath: runtimeContext.cliPath,
      args: buildSkillsArgs(runtimeContext.profile, {
        skillName
      }),
      timeoutMs: runtimeContext.timeoutMs
    });
  }

  async validateSkill(
    runtimeContext: RuntimeContextSnapshot,
    skillPath: string
  ): Promise<SkillValidationResult> {
    return this.runner.executeJson<SkillValidationResult>({
      cliPath: runtimeContext.cliPath,
      args: buildSkillValidateArgs(runtimeContext.profile, skillPath),
      timeoutMs: runtimeContext.timeoutMs
    });
  }
}

export {
  buildProfileArgs,
  buildSkillValidateArgs,
  buildSkillsArgs,
  buildStructuredRunArgs
};
