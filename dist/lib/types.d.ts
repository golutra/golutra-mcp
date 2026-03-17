export declare const GOLUTRA_PROFILES: readonly ["dev", "canary", "stable"];
export type GolutraProfile = (typeof GOLUTRA_PROFILES)[number];
export interface RuntimeContextSnapshot {
    cliPath: string;
    profile?: GolutraProfile | undefined;
    workspacePath?: string | undefined;
    timeoutMs: number;
}
export interface CommandContextInput {
    cliPath?: string | undefined;
    profile?: GolutraProfile | undefined;
    workspacePath?: string | undefined;
    timeoutMs?: number | undefined;
}
export interface CliCommandRequest {
    cliPath: string;
    args: string[];
    timeoutMs: number;
}
export interface StructuredCommandEnvelope {
    ok: boolean;
    requestId?: string | undefined;
    result?: {
        status: string;
        message?: string | undefined;
        data?: unknown;
    } | undefined;
    error?: string | undefined;
}
export interface ListSkillsResponse {
    skills?: Record<string, {
        description?: string | undefined;
    }> | undefined;
    projectSkillsRoot?: string | undefined;
    projectSkills?: ProjectSkillDescriptor[] | undefined;
    projectSkillsNote?: string | undefined;
}
export interface ProjectSkillDescriptor {
    name: string;
    targetPath: string;
    skillMdPath: string;
    relativePath: string;
}
export interface SkillValidationResult {
    ok?: boolean | undefined;
    message?: string | undefined;
    errors?: unknown[] | undefined;
}
export interface ChatConversationsListData {
    channels?: unknown[] | undefined;
    directs?: unknown[] | undefined;
    conversations?: unknown[] | undefined;
    defaultChannelId?: string | undefined;
}
export interface ChatMessagesListData {
    messages?: unknown[] | undefined;
}
export interface ChatSendData {
    messageId?: string | undefined;
}
export interface RoadmapResultData {
    workspaceId?: string | undefined;
    workspacePath?: string | undefined;
    conversationId?: string | null | undefined;
    roadmap?: unknown;
    source?: string | undefined;
    storage?: string | undefined;
    warning?: string | undefined;
}
export type StructuredCommand = {
    type: "chat.send";
    payload: {
        workspacePath: string;
        conversationId: string;
        senderId: string;
        text: string;
        mentionIds: string[];
    };
} | {
    type: "chat.conversations.list";
    payload: {
        workspacePath: string;
        userId: string;
    };
} | {
    type: "chat.messages.list";
    payload: {
        workspacePath: string;
        conversationId: string;
        limit?: number | undefined;
        beforeId?: string | undefined;
    };
} | {
    type: "roadmap.read";
    payload: {
        workspacePath: string;
        conversationId?: string | undefined;
    };
} | {
    type: "roadmap.update";
    payload: {
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
    };
};
