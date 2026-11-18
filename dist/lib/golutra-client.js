import { resolveRuntimeTargets } from "./context.js";
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
function buildCliGuideArgs(profile, guide, full = false) {
    return [
        ...buildProfileArgs(profile),
        ...(guide === "help" ? ["--help"] : [guide, ...(full ? ["--full"] : [])])
    ];
}
function buildStructuredRunArgs(profile, timeoutMs) {
    return [
        ...buildProfileArgs(profile),
        "run",
        "--stdin",
        "--timeout-ms",
        String(timeoutMs)
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
function buildTargetEnv(target) {
    return {
        GOLUTRA_CLI_HOST_KIND: target.hostKind ?? "auto"
    };
}
export class GolutraCliGateway {
    runner;
    chatCompatibility;
    constructor(runner) {
        this.runner = runner;
    }
    async executeJsonWithRuntimeTargets(runtimeContext, buildArgs, stdin, processTimeoutMs = runtimeContext.timeoutMs + 1500) {
        const target = resolveRuntimeTargets(runtimeContext)[0] ?? {};
        return this.runner.executeJson({
            cliPath: runtimeContext.cliPath,
            args: buildArgs(target),
            env: buildTargetEnv(target),
            timeoutMs: processTimeoutMs,
            stdin
        });
    }
    async executeTextWithRuntimeTargets(runtimeContext, buildArgs) {
        if (!this.runner.executeText) {
            throw new Error("CLI text execution is not available");
        }
        const target = resolveRuntimeTargets(runtimeContext)[0] ?? {};
        return this.runner.executeText({
            cliPath: runtimeContext.cliPath,
            args: buildArgs(target),
            env: buildTargetEnv(target),
            timeoutMs: runtimeContext.timeoutMs
        });
    }
    async readCliGuide(runtimeContext, guide, full = false) {
        const text = await this.executeTextWithRuntimeTargets(runtimeContext, (target) => buildCliGuideArgs(target.profile, guide, full));
        return {
            guide,
            text
        };
    }
    async executeCommand(command, runtimeContext) {
        const response = await this.executeJsonWithRuntimeTargets(runtimeContext, (target) => buildStructuredRunArgs(target.profile, runtimeContext.timeoutMs), JSON.stringify(command));
        if (!response.ok || response.result?.status !== "ok") {
            throw new CliExecutionError({
                message: response.error ??
                    response.result?.message ??
                    "golutra-cli returned an unsuccessful command result",
                cliPath: runtimeContext.cliPath,
                args: buildStructuredRunArgs(resolveRuntimeTargets(runtimeContext)[0]?.profile, runtimeContext.timeoutMs),
                code: response.errorCode,
                requestId: response.requestId ?? undefined,
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
        if (input.workspaceId)
            await this.requireChatSupport(runtimeContext, true, true);
        const payload = {
            type: "chat.messages.list",
            payload: {
                workspacePath: input.workspacePath,
                workspaceId: input.workspaceId,
                userId: input.userId,
                conversationId: input.conversationId,
                ...(typeof input.limit === "number" ? { limit: input.limit } : {}),
                ...(input.beforeId ? { beforeId: input.beforeId } : {})
            }
        };
        return this.executeCommand(payload, runtimeContext);
    }
    async requireChatSupport(context, crossWorkspace = false, externalChannel = false) {
        const key = JSON.stringify([context.cliPath, resolveRuntimeTargets(context)]);
        if (this.chatCompatibility?.key !== key) {
            this.chatCompatibility = { key, check: this.readCliInfo(context) };
        }
        const current = this.chatCompatibility;
        try {
            const info = await current.check;
            // 缓存能力快照，每次按当前操作校验，不能把本地发送成功当作已支持跨区。
            const required = ["chatSendDraft", "chatRetryFile", "chatInboxAllPages", "chatRetryDiagnostic"];
            if (crossWorkspace) {
                required.push("chatCrossWorkspace");
            }
            if (externalChannel) {
                required.push("chatCrossWorkspaceChannels");
            }
            const missing = required.filter(capability => !Array.isArray(info.capabilities) || !info.capabilities.includes(capability));
            if (missing.length) {
                throw new CliExecutionError({
                    message: `Update Golutra CLI and Host together, then set cliPath to the paired executable. Missing CLI capabilities: ${missing.join(", ")}. No message was sent.`,
                    code: "CLI_CHAT_CAPABILITY_REQUIRED", cliPath: context.cliPath, args: ["info", "--json"], exitCode: 0,
                    stdout: JSON.stringify(info)
                });
            }
            if (externalChannel) {
                const host = info.host;
                if (!Array.isArray(host?.capabilities) || !host.capabilities.includes("chatCrossWorkspaceChannels")) {
                    throw new Error("The connected Golutra Host does not support cross-workspace channels. Update Host and CLI together; no command was sent.");
                }
            }
        }
        catch (error) {
            // 只缓存成功的能力检查；更新配置或修复 CLI 后可重查，不能自动换程序重发。
            if (this.chatCompatibility === current) {
                this.chatCompatibility = undefined;
            }
            throw error;
        }
    }
    async sendMessages(context, input) {
        await this.requireChatSupport(context, Boolean(input.to?.workspaceId || input.messages?.some(message => message.to?.workspaceId)), Boolean((input.to?.workspaceId && input.to.conversationId) || input.messages?.some(message => message.to?.workspaceId && message.to.conversationId)));
        return this.executeJsonWithRuntimeTargets(context, target => [
            ...buildProfileArgs(target.profile), "chat", "send", "--stdin", "--timeout-ms", String(context.timeoutMs)
        ], JSON.stringify(input), context.timeoutMs * 2 + 1500);
    }
    async retryMessages(context, retryFile) {
        await this.requireChatSupport(context);
        return this.executeJsonWithRuntimeTargets(context, target => [
            ...buildProfileArgs(target.profile), "chat", "send", "--retry", retryFile, "--timeout-ms", String(context.timeoutMs)
        ]);
    }
    async readInbox(context, input) {
        await this.requireChatSupport(context);
        const response = await this.executeJsonWithRuntimeTargets(context, target => [
            ...buildProfileArgs(target.profile), "chat", "inbox", "--stdin", "--timeout-ms", String(context.timeoutMs)
        ], JSON.stringify(input));
        if (!response.ok || response.result?.status !== "ok" || !response.result.data || typeof response.result.data !== "object") {
            throw new Error(response.error ?? response.result?.message ?? "CLI returned no complete inbox");
        }
        const data = response.result.data;
        if (data.complete !== true || data.nextCursor != null) {
            throw new Error("CLI_INBOX_INCOMPLETE: the CLI did not return a complete frozen inbox; update the paired CLI and Host");
        }
        return data;
    }
    async readCliInfo(context) {
        return this.executeJsonWithRuntimeTargets(context, target => [
            ...buildProfileArgs(target.profile), "info", "--json", "--timeout-ms", String(context.timeoutMs)
        ]);
    }
    async submitCommand(command, context) {
        const response = await this.executeJsonWithRuntimeTargets(context, target => [...buildStructuredRunArgs(target.profile, context.timeoutMs), "--async"], JSON.stringify(command));
        if (!response.ok || !response.requestId) {
            throw new Error(response.error ?? "Async command was not accepted");
        }
        return response;
    }
    async waitCommand(context, requestId) {
        const response = await this.executeJsonWithRuntimeTargets(context, target => [...buildProfileArgs(target.profile), "wait", "--request-id", requestId, "--timeout-ms", String(context.timeoutMs)]);
        if (!response.ok || response.result?.status !== "ok") {
            throw new Error(response.error ?? response.result?.message ?? "Command did not complete successfully");
        }
        return { requestId: response.requestId, result: response.result };
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
    async updateMemberName(runtimeContext, input) {
        return this.executeCommand({
            type: "project.member.name.update",
            payload: {
                workspacePath: input.workspacePath,
                memberId: input.memberId,
                name: input.name
            }
        }, runtimeContext);
    }
    async listChatContacts(runtimeContext, input) {
        await this.requireChatSupport(runtimeContext, true);
        return this.executeCommand({ type: "chat.contacts.list", payload: { ...input } }, runtimeContext);
    }
    async createChannel(runtimeContext, input) {
        if (input.externalMembers?.length)
            await this.requireChatSupport(runtimeContext, true, true);
        if (!input.memberIds.length && !input.externalMembers?.length)
            throw new Error("Provide memberIds or externalMembers.");
        return this.executeCommand({
            type: "chat.channel.create",
            payload: {
                workspacePath: input.workspacePath,
                userId: input.userId,
                memberIds: input.memberIds,
                ...(input.externalMembers?.length ? { externalMembers: input.externalMembers } : {}),
                ...(input.customName ? { customName: input.customName } : {})
            }
        }, runtimeContext);
    }
    async addChannelMembers(runtimeContext, input) {
        if (input.externalMembers?.length || input.workspaceId)
            await this.requireChatSupport(runtimeContext, true, true);
        if (!input.memberIds.length && !input.externalMembers?.length)
            throw new Error("Provide memberIds or externalMembers.");
        return this.executeCommand({ type: "chat.channel.members.add", payload: { ...input } }, runtimeContext);
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
    async exportFriendTemplateRepositoryWorkspace(runtimeContext, input) {
        const workspaceId = input.workspaceId?.trim() ||
            (await this.listTeamConfig(runtimeContext, {
                workspacePath: input.workspacePath
            })).workspaceId?.trim();
        if (!workspaceId) {
            throw new Error("workspaceId is required for friend-template.repository.export-workspace");
        }
        return this.executeCommand({
            type: "friend-template.repository.export-workspace",
            payload: {
                workspaceId,
                workspacePath: input.workspacePath,
                ...(input.templateDisplayName
                    ? { templateDisplayName: input.templateDisplayName }
                    : {}),
                ...(input.memberIds?.length ? { memberIds: input.memberIds } : {}),
                ...(input.skillStorePackageBindingsByPath &&
                    Object.keys(input.skillStorePackageBindingsByPath).length > 0
                    ? {
                        skillStorePackageBindingsByPath: input.skillStorePackageBindingsByPath
                    }
                    : {}),
                ...(input.agentStorePackageBindingsByFolderName &&
                    Object.keys(input.agentStorePackageBindingsByFolderName).length > 0
                    ? {
                        agentStorePackageBindingsByFolderName: input.agentStorePackageBindingsByFolderName
                    }
                    : {}),
                ...(input.replaceInstalledPath !== undefined
                    ? {
                        replaceInstalledPath: input.replaceInstalledPath?.trim() || null
                    }
                    : {})
            }
        }, runtimeContext);
    }
    async publishEditedFriendTemplateRepository(runtimeContext, input) {
        return this.executeCommand({
            type: "friend-template.repository.publish-edited",
            payload: {
                fileName: input.fileName,
                targetFilePath: input.targetFilePath,
                ...(input.terminalOverrides ? { terminalOverrides: input.terminalOverrides } : {}),
                ...(input.projectSettings ? { projectSettings: input.projectSettings } : {}),
                ...(input.skillSourceWorkspacePath
                    ? {
                        skillSourceWorkspacePath: input.skillSourceWorkspacePath.trim()
                    }
                    : {})
            }
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
        return this.executeJsonWithRuntimeTargets(runtimeContext, (target) => buildSkillsArgs(target.profile, {
            ...(input.workspacePath ? { workspacePath: input.workspacePath } : {})
        }));
    }
    async getSkill(runtimeContext, skillName) {
        return this.executeJsonWithRuntimeTargets(runtimeContext, (target) => buildSkillsArgs(target.profile, {
            skillName
        }));
    }
    async validateSkill(runtimeContext, skillPath) {
        return this.executeJsonWithRuntimeTargets(runtimeContext, (target) => buildSkillValidateArgs(target.profile, skillPath));
    }
}
export { buildCliGuideArgs, buildProfileArgs, buildSkillValidateArgs, buildSkillsArgs, buildStructuredRunArgs, GOLUTRA_CLI_GUIDES };
//# sourceMappingURL=golutra-client.js.map