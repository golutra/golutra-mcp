import type { CliJsonRunner } from "./cli-runner.js";
import type { ChatConversationsListData, ChatMessagesListData, ChatSendData, CommandContextInput, ListSkillsResponse, ProjectMembersConfigListData, RoadmapResultData, RuntimeContextSnapshot, SkillValidationResult, StructuredCommand } from "./types.js";
declare const GOLUTRA_CLI_GUIDES: readonly ["help", "team", "collaboration", "store", "chat", "terminals", "prompt", "agents", "templates", "roadmap", "member", "assistant", "supervisor"];
type GolutraCliGuide = (typeof GOLUTRA_CLI_GUIDES)[number];
declare function buildProfileArgs(profile: RuntimeContextSnapshot["profile"]): string[];
declare function buildCliGuideArgs(profile: RuntimeContextSnapshot["profile"], guide: GolutraCliGuide): string[];
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
    readCliGuide(runtimeContext: RuntimeContextSnapshot, guide: GolutraCliGuide): Promise<{
        guide: GolutraCliGuide;
        text: string;
    }>;
    executeCommand<T = Record<string, unknown>>(command: StructuredCommand, runtimeContext: RuntimeContextSnapshot): Promise<T>;
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
    listTeamConfig(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
    }): Promise<ProjectMembersConfigListData>;
    listTerminalDefaults(runtimeContext: RuntimeContextSnapshot): Promise<Record<string, unknown>>;
    inviteTerminals(runtimeContext: RuntimeContextSnapshot, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    deleteMember(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        memberId: string;
    }): Promise<Record<string, unknown>>;
    createChannel(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        userId: string;
        memberIds: string[];
        customName?: string | undefined;
    }): Promise<Record<string, unknown>>;
    ensureDirect(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        userId: string;
        targetId: string;
    }): Promise<Record<string, unknown>>;
    updateConversation(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        conversationId: string;
        customName?: string | undefined;
        memberIds?: string[] | undefined;
    }): Promise<Record<string, unknown>>;
    deleteConversation(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        conversationId: string;
    }): Promise<Record<string, unknown>>;
    readPromptTokens(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
    }): Promise<Record<string, unknown>>;
    readPromptOptions(runtimeContext: RuntimeContextSnapshot, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    readProjectPromptSettings(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        roleType: string;
    }): Promise<Record<string, unknown>>;
    updateProjectPromptSettings(runtimeContext: RuntimeContextSnapshot, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    readMemberConfig(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        memberId: string;
    }): Promise<Record<string, unknown>>;
    readMemberPromptSettings(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        memberId: string;
    }): Promise<Record<string, unknown>>;
    updateMemberPromptSettings(runtimeContext: RuntimeContextSnapshot, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    readMemberBinding(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        memberId: string;
    }): Promise<Record<string, unknown>>;
    updateMemberBinding(runtimeContext: RuntimeContextSnapshot, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    readMemberAutomation(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        memberId: string;
    }): Promise<Record<string, unknown>>;
    updateMemberAutomation(runtimeContext: RuntimeContextSnapshot, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    previewOnboardingPrompt(runtimeContext: RuntimeContextSnapshot, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    restartMember(runtimeContext: RuntimeContextSnapshot, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    listAgentsRepository(runtimeContext: RuntimeContextSnapshot): Promise<Record<string, unknown>>;
    createAgentRepositoryEntry(runtimeContext: RuntimeContextSnapshot, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    inspectFriendTemplate(runtimeContext: RuntimeContextSnapshot, input: {
        filePath: string;
    }): Promise<Record<string, unknown>>;
    listFriendTemplateRepository(runtimeContext: RuntimeContextSnapshot): Promise<Record<string, unknown>>;
    useFriendTemplateRepository(runtimeContext: RuntimeContextSnapshot, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    listSkillsLibrary(runtimeContext: RuntimeContextSnapshot): Promise<Record<string, unknown>>;
    createSkillLibraryEntry(runtimeContext: RuntimeContextSnapshot, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    importSkillLibraryEntries(runtimeContext: RuntimeContextSnapshot, input: {
        sourcePaths: string[];
    }): Promise<Record<string, unknown>>;
    listProjectSkills(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
    }): Promise<Record<string, unknown>>;
    linkProjectSkill(runtimeContext: RuntimeContextSnapshot, input: {
        workspacePath: string;
        skillFolderName: string;
    }): Promise<Record<string, unknown>>;
    executeStoreCommand(runtimeContext: RuntimeContextSnapshot, commandType: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    listSkills(runtimeContext: RuntimeContextSnapshot, input: Pick<CommandContextInput, "workspacePath">): Promise<ListSkillsResponse>;
    getSkill(runtimeContext: RuntimeContextSnapshot, skillName: string): Promise<Record<string, unknown>>;
    validateSkill(runtimeContext: RuntimeContextSnapshot, skillPath: string): Promise<SkillValidationResult>;
}
export { buildCliGuideArgs, buildProfileArgs, buildSkillValidateArgs, buildSkillsArgs, buildStructuredRunArgs, GOLUTRA_CLI_GUIDES, normalizeMentionIds };
