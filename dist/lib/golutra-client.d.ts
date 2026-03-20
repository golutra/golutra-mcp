import type { CliJsonRunner } from "./cli-runner.js";
import type { ChatConversationsListData, ChatMessagesListData, ChatSendData, CommandContextInput, ListSkillsResponse, RoadmapResultData, RuntimeContextSnapshot, SkillValidationResult, StructuredCommand } from "./types.js";
declare function buildProfileArgs(profile: RuntimeContextSnapshot["profile"]): string[];
declare function buildStructuredRunArgs(profile: RuntimeContextSnapshot["profile"], command: StructuredCommand): string[];
declare function buildSkillsArgs(profile: RuntimeContextSnapshot["profile"], options: {
    skillName?: string | undefined;
    workspacePath?: string | undefined;
}): string[];
declare function buildSkillValidateArgs(profile: RuntimeContextSnapshot["profile"], skillPath: string): string[];
declare function normalizeMentionIds(mentionIds: string[]): string[];
export declare class GolutraCliGateway {
    private readonly runner;
    constructor(runner: CliJsonRunner);
    private executeStructured;
    listConversations(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        userId: string;
    }): Promise<ChatConversationsListData>;
    listMessages(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        conversationId: string;
        limit?: number | undefined;
        beforeId?: string | undefined;
    }): Promise<ChatMessagesListData>;
    sendMessage(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        conversationId: string;
        senderId: string;
        text: string;
        mentionIds: string[];
    }): Promise<ChatSendData>;
    readRoadmap(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        conversationId?: string | undefined;
    }): Promise<RoadmapResultData>;
    updateRoadmap(runtimeContext: RuntimeContextSnapshot, input: {
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
    }): Promise<RoadmapResultData>;
    listSkills(runtimeContext: RuntimeContextSnapshot, input: Pick<CommandContextInput, "workspacePath">): Promise<ListSkillsResponse>;
    getSkill(runtimeContext: RuntimeContextSnapshot, skillName: string): Promise<Record<string, unknown>>;
    validateSkill(runtimeContext: RuntimeContextSnapshot, skillPath: string): Promise<SkillValidationResult>;
}
export { buildProfileArgs, buildSkillValidateArgs, buildSkillsArgs, buildStructuredRunArgs, normalizeMentionIds };
