import { CliExecutionError } from "./errors.js";
function buildProfileArgs(profile) {
    return profile ? ["--profile", profile] : [];
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
    async executeStructured(command, runtimeContext) {
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
        return this.executeStructured({
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
        return this.executeStructured(payload, runtimeContext);
    }
    async sendMessage(runtimeContext, input) {
        const mentionIds = normalizeMentionIds(input.mentionIds);
        return this.executeStructured({
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
        return this.executeStructured(payload, runtimeContext);
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
        return this.executeStructured(payload, runtimeContext);
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
export { buildProfileArgs, buildSkillValidateArgs, buildSkillsArgs, buildStructuredRunArgs, normalizeMentionIds };
//# sourceMappingURL=golutra-client.js.map