import type { CliJsonRunner } from "./cli-runner.js";
import { CliExecutionError } from "./errors.js";
import type {
  ChatConversationsListData,
  ChatMessagesListData,
  ChatSendData,
  CommandContextInput,
  ListSkillsResponse,
  ProjectMembersConfigListData,
  RoadmapResultData,
  RuntimeContextSnapshot,
  SkillValidationResult,
  StructuredCommand,
  StructuredCommandEnvelope
} from "./types.js";

const GOLUTRA_CLI_GUIDES = [
  "help",
  "team",
  "collaboration",
  "store",
  "chat",
  "terminals",
  "prompt",
  "agents",
  "templates",
  "roadmap",
  "member",
  "assistant",
  "supervisor"
] as const;

type GolutraCliGuide = (typeof GOLUTRA_CLI_GUIDES)[number];

function buildProfileArgs(profile: RuntimeContextSnapshot["profile"]): string[] {
  return profile ? ["--profile", profile] : [];
}

function buildCliGuideArgs(
  profile: RuntimeContextSnapshot["profile"],
  guide: GolutraCliGuide
): string[] {
  return [
    ...buildProfileArgs(profile),
    ...(guide === "help" ? ["--help"] : [guide])
  ];
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

function normalizeMentionIds(mentionIds: string[]): string[] {
  const uniqueMentionIds = new Set<string>();

  for (const mentionId of mentionIds) {
    const normalizedId = mentionId.trim();
    if (!normalizedId) {
      continue;
    }
    if (normalizedId.toLowerCase() === "all") {
      throw new Error("mentionIds does not allow all");
    }
    uniqueMentionIds.add(normalizedId);
  }

  if (uniqueMentionIds.size === 0) {
    throw new Error("mentionIds is required");
  }

  return [...uniqueMentionIds];
}

export class GolutraCliGateway {
  constructor(private readonly runner: CliJsonRunner) {}

  async readCliGuide(
    runtimeContext: RuntimeContextSnapshot,
    guide: GolutraCliGuide
  ): Promise<{ guide: GolutraCliGuide; text: string }> {
    if (!this.runner.executeText) {
      throw new Error("CLI text execution is not available");
    }

    const text = await this.runner.executeText({
      cliPath: runtimeContext.cliPath,
      args: buildCliGuideArgs(runtimeContext.profile, guide),
      timeoutMs: runtimeContext.timeoutMs
    });

    return {
      guide,
      text
    };
  }

  async executeCommand<T = Record<string, unknown>>(
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
    return this.executeCommand<ChatConversationsListData>(
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

    return this.executeCommand<ChatMessagesListData>(
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
    const mentionIds = normalizeMentionIds(input.mentionIds);

    return this.executeCommand<ChatSendData>(
      {
        type: "chat.send",
        payload: {
          workspacePath: input.workspacePath,
          conversationId: input.conversationId,
          senderId: input.senderId,
          text: input.text,
          mentionIds
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

    return this.executeCommand<RoadmapResultData>(
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

    return this.executeCommand<RoadmapResultData>(
      payload,
      runtimeContext
    );
  }

  async listTeamConfig(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string }
  ): Promise<ProjectMembersConfigListData> {
    return this.executeCommand<ProjectMembersConfigListData>(
      {
        type: "project.members.config.list",
        payload: {
          workspacePath: input.workspacePath
        }
      },
      runtimeContext
    );
  }

  async listTerminalDefaults(
    runtimeContext: RuntimeContextSnapshot
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.terminals.defaults.list",
        payload: {}
      },
      runtimeContext
    );
  }

  async inviteTerminals(
    runtimeContext: RuntimeContextSnapshot,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.terminals.invite",
        payload
      },
      runtimeContext
    );
  }

  async deleteMember(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string; memberId: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.member.delete",
        payload: {
          workspacePath: input.workspacePath,
          memberId: input.memberId
        }
      },
      runtimeContext
    );
  }

  async createChannel(
    runtimeContext: RuntimeContextSnapshot,
    input: {
      workspacePath: string;
      userId: string;
      memberIds: string[];
      customName?: string | undefined;
    }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "chat.channel.create",
        payload: {
          workspacePath: input.workspacePath,
          userId: input.userId,
          memberIds: input.memberIds,
          ...(input.customName ? { customName: input.customName } : {})
        }
      },
      runtimeContext
    );
  }

  async ensureDirect(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string; userId: string; targetId: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "chat.direct.ensure",
        payload: {
          workspacePath: input.workspacePath,
          userId: input.userId,
          targetId: input.targetId
        }
      },
      runtimeContext
    );
  }

  async updateConversation(
    runtimeContext: RuntimeContextSnapshot,
    input: {
      workspacePath: string;
      conversationId: string;
      customName?: string | undefined;
      memberIds?: string[] | undefined;
    }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "chat.conversation.update",
        payload: {
          workspacePath: input.workspacePath,
          conversationId: input.conversationId,
          ...(input.customName ? { customName: input.customName } : {}),
          ...(input.memberIds ? { memberIds: input.memberIds } : {})
        }
      },
      runtimeContext
    );
  }

  async deleteConversation(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string; conversationId: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "chat.conversation.delete",
        payload: {
          workspacePath: input.workspacePath,
          conversationId: input.conversationId
        }
      },
      runtimeContext
    );
  }

  async readPromptTokens(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.prompt-settings.tokens.read",
        payload: {
          workspacePath: input.workspacePath
        }
      },
      runtimeContext
    );
  }

  async readPromptOptions(
    runtimeContext: RuntimeContextSnapshot,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.prompt-settings.options.read",
        payload
      },
      runtimeContext
    );
  }

  async readProjectPromptSettings(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string; roleType: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.prompt-settings.read",
        payload: {
          workspacePath: input.workspacePath,
          roleType: input.roleType
        }
      },
      runtimeContext
    );
  }

  async updateProjectPromptSettings(
    runtimeContext: RuntimeContextSnapshot,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.prompt-settings.update",
        payload
      },
      runtimeContext
    );
  }

  async readMemberConfig(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string; memberId: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.member.config.read",
        payload: {
          workspacePath: input.workspacePath,
          memberId: input.memberId
        }
      },
      runtimeContext
    );
  }

  async readMemberPromptSettings(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string; memberId: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.member.prompt-settings.read",
        payload: {
          workspacePath: input.workspacePath,
          memberId: input.memberId
        }
      },
      runtimeContext
    );
  }

  async updateMemberPromptSettings(
    runtimeContext: RuntimeContextSnapshot,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.member.prompt-settings.update",
        payload
      },
      runtimeContext
    );
  }

  async readMemberBinding(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string; memberId: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.member.binding.read",
        payload: {
          workspacePath: input.workspacePath,
          memberId: input.memberId
        }
      },
      runtimeContext
    );
  }

  async updateMemberBinding(
    runtimeContext: RuntimeContextSnapshot,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.member.binding.update",
        payload
      },
      runtimeContext
    );
  }

  async readMemberAutomation(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string; memberId: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.member.automation.read",
        payload: {
          workspacePath: input.workspacePath,
          memberId: input.memberId
        }
      },
      runtimeContext
    );
  }

  async updateMemberAutomation(
    runtimeContext: RuntimeContextSnapshot,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.member.automation.update",
        payload
      },
      runtimeContext
    );
  }

  async previewOnboardingPrompt(
    runtimeContext: RuntimeContextSnapshot,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "terminal.preview-onboarding-prompt",
        payload
      },
      runtimeContext
    );
  }

  async restartMember(
    runtimeContext: RuntimeContextSnapshot,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "terminal.session.restart-member",
        payload
      },
      runtimeContext
    );
  }

  async listAgentsRepository(
    runtimeContext: RuntimeContextSnapshot
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "agents.repository.list",
        payload: {}
      },
      runtimeContext
    );
  }

  async createAgentRepositoryEntry(
    runtimeContext: RuntimeContextSnapshot,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "agents.repository.create",
        payload
      },
      runtimeContext
    );
  }

  async inspectFriendTemplate(
    runtimeContext: RuntimeContextSnapshot,
    input: { filePath: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "friend-template.inspect",
        payload: {
          filePath: input.filePath
        }
      },
      runtimeContext
    );
  }

  async listFriendTemplateRepository(
    runtimeContext: RuntimeContextSnapshot
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "friend-template.repository.list",
        payload: {}
      },
      runtimeContext
    );
  }

  async useFriendTemplateRepository(
    runtimeContext: RuntimeContextSnapshot,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "friend-template.repository.use",
        payload
      },
      runtimeContext
    );
  }

  async listSkillsLibrary(
    runtimeContext: RuntimeContextSnapshot
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "skills.library.list",
        payload: {}
      },
      runtimeContext
    );
  }

  async createSkillLibraryEntry(
    runtimeContext: RuntimeContextSnapshot,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "skills.library.create",
        payload
      },
      runtimeContext
    );
  }

  async importSkillLibraryEntries(
    runtimeContext: RuntimeContextSnapshot,
    input: { sourcePaths: string[] }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "skills.library.import",
        payload: {
          sourcePaths: input.sourcePaths
        }
      },
      runtimeContext
    );
  }

  async listProjectSkills(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.skills.list",
        payload: {
          workspacePath: input.workspacePath
        }
      },
      runtimeContext
    );
  }

  async linkProjectSkill(
    runtimeContext: RuntimeContextSnapshot,
    input: { workspacePath: string; skillFolderName: string }
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: "project.skills.link",
        payload: {
          workspacePath: input.workspacePath,
          skillFolderName: input.skillFolderName
        }
      },
      runtimeContext
    );
  }

  async executeStoreCommand(
    runtimeContext: RuntimeContextSnapshot,
    commandType: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeCommand(
      {
        type: commandType,
        payload
      },
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
  buildCliGuideArgs,
  buildProfileArgs,
  buildSkillValidateArgs,
  buildSkillsArgs,
  buildStructuredRunArgs,
  GOLUTRA_CLI_GUIDES,
  normalizeMentionIds
};
