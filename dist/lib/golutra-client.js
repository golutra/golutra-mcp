import { CliExecutionError } from "./errors.js";
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
];
function buildProfileArgs(profile) {
    return profile ? ["--profile", profile] : [];
}
function buildCliGuideArgs(profile, guide) {
    return [
        ...buildProfileArgs(profile),
        ...(guide === "help" ? ["--help"] : [guide])
    ];
}
function buildStructuredRunArgs(profile, command) {
    return [
        ...buildProfileArgs(profile),
        "run",
        "--command",
        JSON.stringify(command)
    ];
}
function buildSkillsArgs(profile, options) {
    const args = [...buildProfileArgs(profile), "skills"];
    if (options.workspacePath) {
        args.push("--workspace", options.workspacePath);
    }
    if (options.skillName) {
        args.push(options.skillName);
    }
    return args;
}
function buildSkillValidateArgs(profile, skillPath) {
    return [...buildProfileArgs(profile), "skill-validate", skillPath];
}
function normalizeMentionIds(mentionIds) {
    const uniqueMentionIds = new Set();
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
    runner;
    constructor(runner) {
        this.runner = runner;
    }
    async readCliGuide(runtimeContext, guide) {
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
    async executeCommand(command, runtimeContext) {
        const response = await this.runner.executeJson({
            cliPath: runtimeContext.cliPath,
            args: buildStructuredRunArgs(runtimeContext.profile, command),
            timeoutMs: runtimeContext.timeoutMs
        });
        if (!response.ok || response.result?.status !== "ok") {
            throw new CliExecutionError({
                message: response.error ??
                    response.result?.message ??
                    "golutra-cli returned an unsuccessful command result",
                cliPath: runtimeContext.cliPath,
                args: buildStructuredRunArgs(runtimeContext.profile, command),
                exitCode: 1
            });
        }
        return (response.result?.data ?? {});
    }
    async listConversations(runtimeContext, input) {
        return this.executeCommand({
            type: "chat.conversations.list",
            payload: {
                workspacePath: input.workspacePath,
                userId: input.userId
            }
        }, runtimeContext);
    }
    async listMessages(runtimeContext, input) {
        const payload = {
            type: "chat.messages.list",
            payload: {
                workspacePath: input.workspacePath,
                conversationId: input.conversationId,
                ...(typeof input.limit === "number" ? { limit: input.limit } : {}),
                ...(input.beforeId ? { beforeId: input.beforeId } : {})
            }
        };
        return this.executeCommand(payload, runtimeContext);
    }
    async sendMessage(runtimeContext, input) {
        const mentionIds = normalizeMentionIds(input.mentionIds);
        return this.executeCommand({
            type: "chat.send",
            payload: {
                workspacePath: input.workspacePath,
                conversationId: input.conversationId,
                senderId: input.senderId,
                text: input.text,
                mentionIds
            }
        }, runtimeContext);
    }
    async readRoadmap(runtimeContext, input) {
        const payload = {
            type: "roadmap.read",
            payload: {
                workspacePath: input.workspacePath,
                ...(input.conversationId ? { conversationId: input.conversationId } : {})
            }
        };
        return this.executeCommand(payload, runtimeContext);
    }
    async updateRoadmap(runtimeContext, input) {
        const payload = {
            type: "roadmap.update",
            payload: {
                workspacePath: input.workspacePath,
                ...(input.conversationId ? { conversationId: input.conversationId } : {}),
                ...(typeof input.readOnly === "boolean" ? { readOnly: input.readOnly } : {}),
                roadmap: input.roadmap
            }
        };
        return this.executeCommand(payload, runtimeContext);
    }
    async listTeamConfig(runtimeContext, input) {
        return this.executeCommand({
            type: "project.members.config.list",
            payload: {
                workspacePath: input.workspacePath
            }
        }, runtimeContext);
    }
    async listTerminalDefaults(runtimeContext) {
        return this.executeCommand({
            type: "project.terminals.defaults.list",
            payload: {}
        }, runtimeContext);
    }
    async inviteTerminals(runtimeContext, payload) {
        return this.executeCommand({
            type: "project.terminals.invite",
            payload
        }, runtimeContext);
    }
    async deleteMember(runtimeContext, input) {
        return this.executeCommand({
            type: "project.member.delete",
            payload: {
                workspacePath: input.workspacePath,
                memberId: input.memberId
            }
        }, runtimeContext);
    }
    async createChannel(runtimeContext, input) {
        return this.executeCommand({
            type: "chat.channel.create",
            payload: {
                workspacePath: input.workspacePath,
                userId: input.userId,
                memberIds: input.memberIds,
                ...(input.customName ? { customName: input.customName } : {})
            }
        }, runtimeContext);
    }
    async ensureDirect(runtimeContext, input) {
        return this.executeCommand({
            type: "chat.direct.ensure",
            payload: {
                workspacePath: input.workspacePath,
                userId: input.userId,
                targetId: input.targetId
            }
        }, runtimeContext);
    }
    async updateConversation(runtimeContext, input) {
        return this.executeCommand({
            type: "chat.conversation.update",
            payload: {
                workspacePath: input.workspacePath,
                conversationId: input.conversationId,
                ...(input.customName ? { customName: input.customName } : {}),
                ...(input.memberIds ? { memberIds: input.memberIds } : {})
            }
        }, runtimeContext);
    }
    async deleteConversation(runtimeContext, input) {
        return this.executeCommand({
            type: "chat.conversation.delete",
            payload: {
                workspacePath: input.workspacePath,
                conversationId: input.conversationId
            }
        }, runtimeContext);
    }
    async readPromptTokens(runtimeContext, input) {
        return this.executeCommand({
            type: "project.prompt-settings.tokens.read",
            payload: {
                workspacePath: input.workspacePath
            }
        }, runtimeContext);
    }
    async readPromptOptions(runtimeContext, payload) {
        return this.executeCommand({
            type: "project.prompt-settings.options.read",
            payload
        }, runtimeContext);
    }
    async readProjectPromptSettings(runtimeContext, input) {
        return this.executeCommand({
            type: "project.prompt-settings.read",
            payload: {
                workspacePath: input.workspacePath,
                roleType: input.roleType
            }
        }, runtimeContext);
    }
    async updateProjectPromptSettings(runtimeContext, payload) {
        return this.executeCommand({
            type: "project.prompt-settings.update",
            payload
        }, runtimeContext);
    }
    async readMemberConfig(runtimeContext, input) {
        return this.executeCommand({
            type: "project.member.config.read",
            payload: {
                workspacePath: input.workspacePath,
                memberId: input.memberId
            }
        }, runtimeContext);
    }
    async readMemberPromptSettings(runtimeContext, input) {
        return this.executeCommand({
            type: "project.member.prompt-settings.read",
            payload: {
                workspacePath: input.workspacePath,
                memberId: input.memberId
            }
        }, runtimeContext);
    }
    async updateMemberPromptSettings(runtimeContext, payload) {
        return this.executeCommand({
            type: "project.member.prompt-settings.update",
            payload
        }, runtimeContext);
    }
    async readMemberBinding(runtimeContext, input) {
        return this.executeCommand({
            type: "project.member.binding.read",
            payload: {
                workspacePath: input.workspacePath,
                memberId: input.memberId
            }
        }, runtimeContext);
    }
    async updateMemberBinding(runtimeContext, payload) {
        return this.executeCommand({
            type: "project.member.binding.update",
            payload
        }, runtimeContext);
    }
    async readMemberAutomation(runtimeContext, input) {
        return this.executeCommand({
            type: "project.member.automation.read",
            payload: {
                workspacePath: input.workspacePath,
                memberId: input.memberId
            }
        }, runtimeContext);
    }
    async updateMemberAutomation(runtimeContext, payload) {
        return this.executeCommand({
            type: "project.member.automation.update",
            payload
        }, runtimeContext);
    }
    async previewOnboardingPrompt(runtimeContext, payload) {
        return this.executeCommand({
            type: "terminal.preview-onboarding-prompt",
            payload
        }, runtimeContext);
    }
    async restartMember(runtimeContext, payload) {
        return this.executeCommand({
            type: "terminal.session.restart-member",
            payload
        }, runtimeContext);
    }
    async listAgentsRepository(runtimeContext) {
        return this.executeCommand({
            type: "agents.repository.list",
            payload: {}
        }, runtimeContext);
    }
    async createAgentRepositoryEntry(runtimeContext, payload) {
        return this.executeCommand({
            type: "agents.repository.create",
            payload
        }, runtimeContext);
    }
    async inspectFriendTemplate(runtimeContext, input) {
        return this.executeCommand({
            type: "friend-template.inspect",
            payload: {
                filePath: input.filePath
            }
        }, runtimeContext);
    }
    async listFriendTemplateRepository(runtimeContext) {
        return this.executeCommand({
            type: "friend-template.repository.list",
            payload: {}
        }, runtimeContext);
    }
    async useFriendTemplateRepository(runtimeContext, payload) {
        return this.executeCommand({
            type: "friend-template.repository.use",
            payload
        }, runtimeContext);
    }
    async listSkillsLibrary(runtimeContext) {
        return this.executeCommand({
            type: "skills.library.list",
            payload: {}
        }, runtimeContext);
    }
    async createSkillLibraryEntry(runtimeContext, payload) {
        return this.executeCommand({
            type: "skills.library.create",
            payload
        }, runtimeContext);
    }
    async importSkillLibraryEntries(runtimeContext, input) {
        return this.executeCommand({
            type: "skills.library.import",
            payload: {
                sourcePaths: input.sourcePaths
            }
        }, runtimeContext);
    }
    async listProjectSkills(runtimeContext, input) {
        return this.executeCommand({
            type: "project.skills.list",
            payload: {
                workspacePath: input.workspacePath
            }
        }, runtimeContext);
    }
    async linkProjectSkill(runtimeContext, input) {
        return this.executeCommand({
            type: "project.skills.link",
            payload: {
                workspacePath: input.workspacePath,
                skillFolderName: input.skillFolderName
            }
        }, runtimeContext);
    }
    async executeStoreCommand(runtimeContext, commandType, payload) {
        return this.executeCommand({
            type: commandType,
            payload
        }, runtimeContext);
    }
    async listSkills(runtimeContext, input) {
        return this.runner.executeJson({
            cliPath: runtimeContext.cliPath,
            args: buildSkillsArgs(runtimeContext.profile, {
                ...(input.workspacePath ? { workspacePath: input.workspacePath } : {})
            }),
            timeoutMs: runtimeContext.timeoutMs
        });
    }
    async getSkill(runtimeContext, skillName) {
        return this.runner.executeJson({
            cliPath: runtimeContext.cliPath,
            args: buildSkillsArgs(runtimeContext.profile, {
                skillName
            }),
            timeoutMs: runtimeContext.timeoutMs
        });
    }
    async validateSkill(runtimeContext, skillPath) {
        return this.runner.executeJson({
            cliPath: runtimeContext.cliPath,
            args: buildSkillValidateArgs(runtimeContext.profile, skillPath),
            timeoutMs: runtimeContext.timeoutMs
        });
    }
}
export { buildCliGuideArgs, buildProfileArgs, buildSkillValidateArgs, buildSkillsArgs, buildStructuredRunArgs, GOLUTRA_CLI_GUIDES, normalizeMentionIds };
//# sourceMappingURL=golutra-client.js.map