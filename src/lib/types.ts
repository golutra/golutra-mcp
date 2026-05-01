export const GOLUTRA_PROFILES = ["dev", "canary", "stable"] as const;
export const GOLUTRA_HOST_KINDS = ["desktop", "server"] as const;

export type GolutraProfile = (typeof GOLUTRA_PROFILES)[number];
export type GolutraHostKind = (typeof GOLUTRA_HOST_KINDS)[number];

export interface GolutraRuntimeTarget {
  profile: GolutraProfile;
  hostKind: GolutraHostKind;
}

export interface RuntimeContextSnapshot {
  cliPath: string;
  profile?: GolutraProfile | undefined;
  hostKind?: GolutraHostKind | undefined;
  targetOrder?: GolutraRuntimeTarget[] | undefined;
  workspacePath?: string | undefined;
  timeoutMs: number;
}

export interface CommandContextInput {
  cliPath?: string | undefined;
  profile?: GolutraProfile | undefined;
  hostKind?: GolutraHostKind | undefined;
  targetOrder?: GolutraRuntimeTarget[] | undefined;
  workspacePath?: string | undefined;
  timeoutMs?: number | undefined;
}

export interface CliCommandRequest {
  cliPath: string;
  args: string[];
  env?: Record<string, string | undefined> | undefined;
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
  skills?: Record<string, { description?: string | undefined }> | undefined;
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

export interface ChatConversationMember {
  id: string;
  name?: string | undefined;
  roleType: string;
  terminalStatus?: string | undefined;
  agent?: unknown;
  skills?: unknown[] | undefined;
}

export interface ChatConversationRecord {
  id: string;
  type: string;
  customName?: string | undefined;
  memberIds: string[];
}

export interface ChatConversationsListData {
  membersById?: Record<string, ChatConversationMember> | undefined;
  conversations?: ChatConversationRecord[] | undefined;
  defaultChannelId?: string | undefined;
}

export interface ProjectMembersConfigListData {
  workspaceId?: string | undefined;
  workspacePath?: string | undefined;
  members?: unknown[] | undefined;
  conversationSummary?: {
    defaultChannelId?: string | undefined;
    channels?: ChatConversationRecord[] | undefined;
    directs?: ChatConversationRecord[] | undefined;
    warning?: string | undefined;
  } | undefined;
  source?: string | undefined;
  warning?: string | null | undefined;
}

export interface ChatMessageRecord {
  messageId?: string | undefined;
  senderId?: string | undefined;
  createdAt: number;
  text: string;
}

export interface ChatMessagesListData {
  messages?: ChatMessageRecord[] | undefined;
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

export interface StructuredCommand {
  type: string;
  payload: Record<string, unknown>;
}
