import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ContextStore } from "./context.js";
import {
  buildSkippedAppProbe,
  classifyAppProbeFailure,
  classifyCliProbeFailure,
  type DiagnosisCheck,
  inspectCliPath,
  inspectUserId,
  inspectWorkspacePath,
  mergeNextSteps,
  summarizeDiagnosis
} from "./diagnostics.js";
import type { GolutraCliGateway } from "./golutra-client.js";
import { GOLUTRA_CLI_GUIDES } from "./golutra-client.js";
import {
  findProjectSkillByName,
  readProjectSkillDocument
} from "./project-skills.js";
import { buildToolError, buildToolSuccess } from "./tool-results.js";

const optionalWorkspacePath = z.string().trim().min(1).optional();
const optionalCliPath = z.string().trim().min(1).optional();
const optionalProfile = z.enum(["dev", "canary", "stable"]).optional();
const optionalTimeout = z.number().int().positive().max(300_000).optional();
const optionalConversationId = z.string().trim().min(1).optional();
const nonEmptyString = z.string().trim().min(1);
const projectMemberIdsSchema = z.array(nonEmptyString).min(2);
const stringArraySchema = z.array(nonEmptyString);
const optionalJsonObject = z.record(z.unknown()).optional();
const roleTypeSchema = z.enum(["assistant", "supervisor", "member"]);
const promptRoleTypeSchema = z.enum(["assistant", "supervisor", "member"]);
const cliGuideSchema = z.enum(GOLUTRA_CLI_GUIDES);
const storeCommandTypeSchema = z.enum([
  "store.packages.list",
  "store.package.read",
  "store.package.releases.list",
  "store.reviews.list",
  "store.review.replies.list",
  "store.package.review.mine",
  "store.package.review.upsert",
  "store.submissions.mine",
  "store.submission.clone-as-new-version",
  "store.submissions.create",
  "store.submission.update",
  "store.install",
  "store.local-updates.preview",
  "store.local-updates.start",
  "store.install-task.get",
  "store.install-task.list"
]);
const workspaceOverrideNote =
  "When workspacePath is passed here, it only applies to this call and does not update the stored default workspace.";
const persistedContextNote =
  "Use golutra-set-context only when you want to persist new defaults for later tool calls.";
const mentionIdsSchema = z
  .array(z.string().trim().min(1))
  .min(1)
  .refine(
    (mentionIds) =>
      mentionIds.every((mentionId) => mentionId.trim().toLowerCase() !== "all"),
    {
      message: "mentionIds does not allow all"
    }
  );

const roadmapTaskSchema = z.object({
  id: z.number().int().positive(),
  number: z.string().trim().optional(),
  title: z.string().trim().min(1),
  status: z.enum(["pending", "in-progress", "done"]),
  pinned: z.boolean().optional()
});

const roadmapSchema = z.object({
  objective: z.string(),
  tasks: z.array(roadmapTaskSchema)
});

const structuredCommandSchema = z.object({
  type: nonEmptyString,
  payload: z.record(z.unknown()).default({})
});

const nullableJsonValueSchema = z.unknown().nullable().optional();

interface DiagnosisChecks {
  cliPath: DiagnosisCheck;
  cliCommand: DiagnosisCheck;
  workspace: DiagnosisCheck;
  userId: DiagnosisCheck;
  appConnection: DiagnosisCheck;
}

function toDiagnosisRecord(checks: DiagnosisChecks): Record<string, DiagnosisCheck> {
  return {
    ...checks
  };
}

export function registerTools(
  server: McpServer,
  contextStore: ContextStore,
  gateway: GolutraCliGateway
): void {
  server.registerTool(
    "golutra-get-context",
    {
      title: "Get Golutra MCP context",
      description:
        "Read the current default golutra-cli path, profile, workspace path, and timeout."
    },
    () => buildToolSuccess("Current MCP context.", contextStore.getSnapshot())
  );

  server.registerTool(
    "golutra-set-context",
    {
      title: "Set Golutra MCP context",
      description:
        "Persist new default golutra-cli path, profile, workspace path, or timeout values for later tool calls. Per-tool workspacePath input remains a one-time override.",
      inputSchema: {
        cliPath: optionalCliPath,
        profile: optionalProfile,
        workspacePath: optionalWorkspacePath,
        timeoutMs: optionalTimeout
      }
    },
    (input) => {
      try {
        const nextContext = contextStore.update(input);
        return buildToolSuccess("Updated MCP context.", nextContext);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-reset-context",
    {
      title: "Reset Golutra MCP context",
      description:
        "Reset the stored CLI path, profile, workspace path, and timeout back to the startup environment defaults."
    },
    () =>
      buildToolSuccess(
        "Reset MCP context to startup defaults.",
        contextStore.reset()
      )
  );

  server.registerTool(
    "golutra-diagnose",
    {
      title: "Diagnose Golutra connectivity",
      description:
        `Check whether golutra-cli is callable and, when workspacePath and userId are available, whether the running Golutra app accepts workspace-scoped commands. ${workspaceOverrideNote} ${persistedContextNote}`,
      inputSchema: {
        userId: z.string().trim().min(1).optional(),
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        cliPath: optionalCliPath,
        timeoutMs: optionalTimeout
      }
    },
    async (input) => {
      const runtimeContext = contextStore.resolveCommandContext(input);
      const checks: DiagnosisChecks = {
        cliPath: inspectCliPath(runtimeContext.cliPath),
        cliCommand: {
          ok: false,
          skipped: true
        },
        workspace: {
          ok: false,
          skipped: true
        },
        userId: {
          ok: false,
          skipped: true
        },
        appConnection: {
          ok: false,
          skipped: true
        }
      };
      const nextStepGroups: string[][] = [];

      if (!checks.cliPath.ok) {
        checks.cliCommand = {
          ok: false,
          skipped: true,
          reasonCode: "APP_PROBE_SKIPPED",
          message:
            "CLI command probe was skipped because the configured golutra-cli path is not available."
        };
        checks.workspace = inspectWorkspacePath(runtimeContext.workspacePath);
        checks.userId = inspectUserId(input.userId);
        checks.appConnection = buildSkippedAppProbe(
          "APP_PROBE_SKIPPED",
          "App-backed diagnostic probe was skipped because the CLI binary could not be located."
        );
        nextStepGroups.push([
          "Set GOLUTRA_CLI_PATH to a valid golutra-cli binary path, or install golutra-cli on PATH."
        ]);

        const diagnosis = {
          context: runtimeContext,
          checks,
          summary: summarizeDiagnosis(toDiagnosisRecord(checks)),
          nextSteps: mergeNextSteps(nextStepGroups)
        };
        return buildToolSuccess("Golutra diagnosis completed.", diagnosis);
      }

      try {
        const skills = await gateway.listSkills(runtimeContext, {});
        checks.cliCommand = {
          ok: true,
          skipped: false,
          command: "skills",
          builtInSkillNames: Object.keys(skills.skills ?? {}),
          projectSkillsCount: Array.isArray(skills.projectSkills)
            ? skills.projectSkills.length
            : 0
        };
      } catch (error) {
        const cliProbe = classifyCliProbeFailure(error);
        checks.cliCommand = {
          ...cliProbe
        };
        checks.workspace = inspectWorkspacePath(runtimeContext.workspacePath);
        checks.userId = inspectUserId(input.userId);
        checks.appConnection = buildSkippedAppProbe(
          "APP_PROBE_SKIPPED",
          "App-backed diagnostic probe was skipped because the CLI-level probe did not succeed."
        );
        nextStepGroups.push(cliProbe.nextSteps);

        const diagnosis = {
          context: runtimeContext,
          checks,
          summary: summarizeDiagnosis(toDiagnosisRecord(checks)),
          nextSteps: mergeNextSteps(nextStepGroups)
        };
        return buildToolSuccess("Golutra diagnosis completed.", diagnosis);
      }

      checks.workspace = inspectWorkspacePath(runtimeContext.workspacePath);
      if (!checks.workspace.ok) {
        nextStepGroups.push([
          "Pass workspacePath to golutra-diagnose, or set a default with golutra-set-context before retrying.",
          "Verify that the workspace path exists locally and points to the intended Golutra workspace folder."
        ]);
        checks.userId = inspectUserId(input.userId);
        checks.appConnection = buildSkippedAppProbe(
          "APP_PROBE_SKIPPED",
          "App-backed diagnostic probe was skipped because workspacePath is missing or invalid."
        );
        const diagnosis = {
          context: runtimeContext,
          checks,
          summary: summarizeDiagnosis(toDiagnosisRecord(checks)),
          nextSteps: mergeNextSteps(nextStepGroups)
        };
        return buildToolSuccess("Golutra diagnosis completed.", diagnosis);
      }

      checks.userId = input.userId
        ? inspectUserId(input.userId)
        : {
            ok: true,
            skipped: true,
            message:
              "userId was not provided; app probe uses project.members.config.list and does not require one."
          };

      try {
        const teamConfig = await gateway.listTeamConfig(runtimeContext, {
          workspacePath: runtimeContext.workspacePath as string
        });
        const conversationSummary = teamConfig.conversationSummary ?? {};
        checks.appConnection = {
          ok: true,
          skipped: false,
          probe: "project.members.config.list",
          memberCount: Array.isArray(teamConfig.members)
            ? teamConfig.members.length
            : 0,
          channelCount: Array.isArray(conversationSummary.channels)
            ? conversationSummary.channels.length
            : 0,
          directCount: Array.isArray(conversationSummary.directs)
            ? conversationSummary.directs.length
            : 0,
          defaultChannelId: conversationSummary.defaultChannelId
        };
      } catch (error) {
        const appProbe = classifyAppProbeFailure(error, runtimeContext);
        checks.appConnection = {
          ...appProbe,
          probe: "project.members.config.list"
        };
        nextStepGroups.push(appProbe.nextSteps);
      }

      const diagnosis: Record<string, unknown> = {
        context: runtimeContext,
        checks,
        summary: summarizeDiagnosis(toDiagnosisRecord(checks)),
        nextSteps: mergeNextSteps(nextStepGroups)
      };

      return buildToolSuccess("Golutra diagnosis completed.", diagnosis);
    }
  );

  server.registerTool(
    "golutra-run-command",
    {
      title: "Run a Golutra structured CLI command",
      description:
        `Run any supported golutra-cli structured command. Prefer the focused MCP tools when one exists; use this for newly added or less common CLI commands. ${persistedContextNote}`,
      inputSchema: {
        command: structuredCommandSchema,
        profile: optionalProfile,
        cliPath: optionalCliPath,
        timeoutMs: optionalTimeout
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.executeCommand(input.command, runtimeContext);
        return buildToolSuccess(`Ran ${input.command.type}.`, result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-read-cli-guide",
    {
      title: "Read a Golutra CLI guide",
      description:
        `Read one top-level golutra-cli guide/help page for team building, collaboration, assets, prompt settings, roles, and other agent-facing workflows. ${persistedContextNote}`,
      inputSchema: {
        guide: cliGuideSchema.default("help"),
        profile: optionalProfile,
        cliPath: optionalCliPath,
        timeoutMs: optionalTimeout
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.readCliGuide(runtimeContext, input.guide);
        return {
          content: [
            {
              type: "text" as const,
              text: result.text
            }
          ],
          structuredContent: result
        };
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-read-team-config",
    {
      title: "Read Golutra team config",
      description:
        `Read one workspace team overview: member config summaries plus conversationSummary for default channel, channels, and directs. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.listTeamConfig(runtimeContext, { workspacePath });
        return buildToolSuccess("Read team config.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-list-terminal-defaults",
    {
      title: "List Golutra terminal defaults",
      description:
        "Read selectable Settings member entries before creating project terminals. Only available entries should be used for terminal creation.",
      inputSchema: {
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.listTerminalDefaults(runtimeContext);
        return buildToolSuccess("Listed terminal defaults.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-create-terminals",
    {
      title: "Create Golutra project terminals",
      description:
        `Create assistant, supervisor, or member terminals and optionally bind agent templates, project skills, and member prompt overrides at creation time. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        roleType: roleTypeSchema,
        command: z.string().trim().optional().nullable(),
        terminalType: z.string().trim().optional().nullable(),
        commandAffixPrefix: z.string().trim().optional().nullable(),
        commandAffixSuffix: z.string().trim().optional().nullable(),
        postReadyWaitPattern: z.string().trim().optional().nullable(),
        instanceCount: z.number().int().positive().max(100).default(1),
        unlimitedAccess: z.boolean().default(false),
        collaborationMode: z.boolean().default(true),
        sandboxed: z.boolean().default(true),
        selectedSkillPaths: stringArraySchema.optional(),
        soloDocumentTemplateFolderName: z.string().trim().optional().nullable(),
        memberOnboardingPromptModeTemplates: nullableJsonValueSchema,
        memberDispatchMessagePrefixRules: nullableJsonValueSchema
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.inviteTerminals(runtimeContext, {
          workspacePath,
          roleType: input.roleType,
          command: input.command ?? null,
          terminalType: input.terminalType ?? null,
          commandAffixPrefix: input.commandAffixPrefix ?? null,
          commandAffixSuffix: input.commandAffixSuffix ?? null,
          postReadyWaitPattern: input.postReadyWaitPattern ?? null,
          instanceCount: input.instanceCount,
          unlimitedAccess: input.unlimitedAccess,
          collaborationMode: input.collaborationMode,
          sandboxed: input.sandboxed,
          selectedSkillPaths: input.selectedSkillPaths ?? [],
          ...(input.soloDocumentTemplateFolderName !== undefined
            ? { soloDocumentTemplateFolderName: input.soloDocumentTemplateFolderName }
            : {}),
          ...(input.memberOnboardingPromptModeTemplates !== undefined
            ? {
                memberOnboardingPromptModeTemplates:
                  input.memberOnboardingPromptModeTemplates
              }
            : {}),
          ...(input.memberDispatchMessagePrefixRules !== undefined
            ? {
                memberDispatchMessagePrefixRules:
                  input.memberDispatchMessagePrefixRules
              }
            : {})
        });
        return buildToolSuccess("Created terminals.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-delete-member",
    {
      title: "Delete a Golutra project member",
      description:
        `Delete one created project member. Before calling this tool, ask the user to confirm the exact memberId and memberName. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        memberId: nonEmptyString,
        memberName: nonEmptyString
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.deleteMember(runtimeContext, {
          workspacePath,
          memberId: input.memberId
        });
        return buildToolSuccess(
          `Deleted project member ${input.memberName}.`,
          result
        );
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-create-channel",
    {
      title: "Create a Golutra channel",
      description:
        `Create one channel and auto-include both userId and owner in the final member set. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        userId: nonEmptyString,
        memberIds: projectMemberIdsSchema,
        customName: z.string().trim().optional()
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.createChannel(runtimeContext, {
          workspacePath,
          userId: input.userId,
          memberIds: input.memberIds,
          customName: input.customName
        });
        return buildToolSuccess("Created channel.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-ensure-direct",
    {
      title: "Ensure a Golutra direct conversation",
      description:
        `Return an existing direct conversation or create one if missing. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        userId: nonEmptyString,
        targetId: nonEmptyString
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.ensureDirect(runtimeContext, {
          workspacePath,
          userId: input.userId,
          targetId: input.targetId
        });
        return buildToolSuccess("Ensured direct conversation.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-update-conversation",
    {
      title: "Update a Golutra conversation",
      description:
        `Rename a conversation, replace a normal channel member set, or do both. DM and default-channel member updates are rejected by Golutra. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        conversationId: nonEmptyString,
        customName: z.string().trim().optional(),
        memberIds: projectMemberIdsSchema.optional()
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.updateConversation(runtimeContext, {
          workspacePath,
          conversationId: input.conversationId,
          customName: input.customName,
          memberIds: input.memberIds
        });
        return buildToolSuccess("Updated conversation.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-delete-conversation",
    {
      title: "Delete a Golutra conversation",
      description:
        `Delete one normal channel or direct conversation. Default-channel deletion is rejected by Golutra. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        conversationId: nonEmptyString
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.deleteConversation(runtimeContext, {
          workspacePath,
          conversationId: input.conversationId
        });
        return buildToolSuccess("Deleted conversation.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-list-conversations",
    {
      title: "List Golutra conversations",
      description:
        `List channel and direct-message conversations visible to a workspace member. ${workspaceOverrideNote}`,
      inputSchema: {
        userId: z.string().trim().min(1),
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.listConversations(runtimeContext, {
          workspacePath,
          userId: input.userId
        });
        return buildToolSuccess("Listed conversations.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-list-messages",
    {
      title: "List Golutra messages",
      description:
        `Read recent messages from a Golutra channel or direct conversation. ${workspaceOverrideNote}`,
      inputSchema: {
        conversationId: z.string().trim().min(1),
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        limit: z.number().int().positive().max(200).optional(),
        beforeId: z.string().trim().min(1).optional()
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.listMessages(runtimeContext, {
          workspacePath,
          conversationId: input.conversationId,
          limit: input.limit,
          beforeId: input.beforeId
        });
        return buildToolSuccess("Listed messages.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-send-message",
    {
      title: "Send a Golutra message",
      description:
        `Send a Golutra chat message through golutra-cli using a structured chat.send payload. ${workspaceOverrideNote}`,
      inputSchema: {
        conversationId: z.string().trim().min(1),
        senderId: z.string().trim().min(1),
        text: z.string().trim().min(1),
        mentionIds: mentionIdsSchema,
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.sendMessage(runtimeContext, {
          workspacePath,
          conversationId: input.conversationId,
          senderId: input.senderId,
          text: input.text,
          mentionIds: input.mentionIds
        });
        return buildToolSuccess("Sent message.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-read-roadmap",
    {
      title: "Read Golutra roadmap",
      description:
        `Read the workspace roadmap or a conversation-specific roadmap through golutra-cli. ${workspaceOverrideNote}`,
      inputSchema: {
        conversationId: optionalConversationId,
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.readRoadmap(runtimeContext, {
          workspacePath,
          ...(input.conversationId ? { conversationId: input.conversationId } : {})
        });
        return buildToolSuccess("Read roadmap.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-update-roadmap",
    {
      title: "Update Golutra roadmap",
      description:
        `Replace the current workspace or conversation roadmap through golutra-cli. ${workspaceOverrideNote}`,
      inputSchema: {
        conversationId: optionalConversationId,
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        readOnly: z.boolean().optional(),
        roadmap: roadmapSchema
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.updateRoadmap(runtimeContext, {
          workspacePath,
          ...(input.conversationId ? { conversationId: input.conversationId } : {}),
          ...(typeof input.readOnly === "boolean" ? { readOnly: input.readOnly } : {}),
          roadmap: input.roadmap
        });
        return buildToolSuccess("Updated roadmap.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-read-prompt-tokens",
    {
      title: "Read Golutra prompt tokens",
      description:
        `Read skillCommands, memberReferences, and conversationReferences for prompt textareas. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.readPromptTokens(runtimeContext, { workspacePath });
        return buildToolSuccess("Read prompt tokens.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-read-prompt-options",
    {
      title: "Read Golutra prompt options",
      description:
        `Read valid prompt-setting filter values for one role or one concrete member. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        roleType: promptRoleTypeSchema.optional(),
        memberId: z.string().trim().optional(),
        userId: z.string().trim().optional()
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.readPromptOptions(runtimeContext, {
          workspacePath,
          ...(input.roleType ? { roleType: input.roleType } : {}),
          ...(input.memberId ? { memberId: input.memberId } : {}),
          ...(input.userId ? { userId: input.userId } : {})
        });
        return buildToolSuccess("Read prompt options.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-read-project-prompt-settings",
    {
      title: "Read Golutra project prompt settings",
      description:
        `Read project-level initial prompts and dispatch suffix rules for one role. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        roleType: promptRoleTypeSchema
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.readProjectPromptSettings(runtimeContext, {
          workspacePath,
          roleType: input.roleType
        });
        return buildToolSuccess("Read project prompt settings.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-update-project-prompt-settings",
    {
      title: "Update Golutra project prompt settings",
      description:
        `Update project-level initial prompts and dispatch suffix rules for one role. Omit a field to keep it; pass null to remove it. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        roleType: promptRoleTypeSchema,
        readOnly: z.boolean().optional(),
        modeTemplates: nullableJsonValueSchema,
        rules: nullableJsonValueSchema
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.updateProjectPromptSettings(runtimeContext, {
          workspacePath,
          roleType: input.roleType,
          ...(typeof input.readOnly === "boolean" ? { readOnly: input.readOnly } : {}),
          ...(input.modeTemplates !== undefined
            ? { modeTemplates: input.modeTemplates }
            : {}),
          ...(input.rules !== undefined ? { rules: input.rules } : {})
        });
        return buildToolSuccess("Updated project prompt settings.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-read-member-config",
    {
      title: "Read Golutra member config",
      description:
        `Read one member's full config snapshot: terminal, agentBinding, skillBinding, promptSettings, and automationSettings. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        memberId: nonEmptyString
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.readMemberConfig(runtimeContext, {
          workspacePath,
          memberId: input.memberId
        });
        return buildToolSuccess("Read member config.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-read-member-prompt-settings",
    {
      title: "Read Golutra member prompt settings",
      description:
        `Read one member's initial prompt overrides and dispatch suffix rules. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        memberId: nonEmptyString
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.readMemberPromptSettings(runtimeContext, {
          workspacePath,
          memberId: input.memberId
        });
        return buildToolSuccess("Read member prompt settings.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-update-member-prompt-settings",
    {
      title: "Update Golutra member prompt settings",
      description:
        `Update one member's initial prompt overrides and dispatch suffix rules. Omit a field to keep it; pass null to remove it. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        memberId: nonEmptyString,
        readOnly: z.boolean().optional(),
        modeTemplates: nullableJsonValueSchema,
        rules: nullableJsonValueSchema
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.updateMemberPromptSettings(runtimeContext, {
          workspacePath,
          memberId: input.memberId,
          ...(typeof input.readOnly === "boolean" ? { readOnly: input.readOnly } : {}),
          ...(input.modeTemplates !== undefined
            ? { modeTemplates: input.modeTemplates }
            : {}),
          ...(input.rules !== undefined ? { rules: input.rules } : {})
        });
        return buildToolSuccess("Updated member prompt settings.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-read-member-binding",
    {
      title: "Read Golutra member binding",
      description:
        `Read one member's agentBinding and skillBinding domains. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        memberId: nonEmptyString
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.readMemberBinding(runtimeContext, {
          workspacePath,
          memberId: input.memberId
        });
        return buildToolSuccess("Read member binding.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-update-member-binding",
    {
      title: "Update Golutra member binding",
      description:
        `Update one member's agentBinding and skillBinding. Omit a domain to keep it; pass null to clear it. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        memberId: nonEmptyString,
        readOnly: z.boolean().optional(),
        agentBinding: nullableJsonValueSchema,
        skillBinding: nullableJsonValueSchema
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.updateMemberBinding(runtimeContext, {
          workspacePath,
          memberId: input.memberId,
          ...(typeof input.readOnly === "boolean" ? { readOnly: input.readOnly } : {}),
          ...(input.agentBinding !== undefined
            ? { agentBinding: input.agentBinding }
            : {}),
          ...(input.skillBinding !== undefined
            ? { skillBinding: input.skillBinding }
            : {})
        });
        return buildToolSuccess("Updated member binding.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-read-member-automation",
    {
      title: "Read Golutra member automation",
      description:
        `Read one member's supervisor settings and scheduled dispatch settings. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        memberId: nonEmptyString
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.readMemberAutomation(runtimeContext, {
          workspacePath,
          memberId: input.memberId
        });
        return buildToolSuccess("Read member automation.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-update-member-automation",
    {
      title: "Update Golutra member automation",
      description:
        `Update supervisorSettings and scheduledDispatchSettings for one member. Omit a domain to keep it; pass null to clear it. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        memberId: nonEmptyString,
        readOnly: z.boolean().optional(),
        supervisorSettings: nullableJsonValueSchema,
        scheduledDispatchSettings: nullableJsonValueSchema
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.updateMemberAutomation(runtimeContext, {
          workspacePath,
          memberId: input.memberId,
          ...(typeof input.readOnly === "boolean" ? { readOnly: input.readOnly } : {}),
          ...(input.supervisorSettings !== undefined
            ? { supervisorSettings: input.supervisorSettings }
            : {}),
          ...(input.scheduledDispatchSettings !== undefined
            ? { scheduledDispatchSettings: input.scheduledDispatchSettings }
            : {})
        });
        return buildToolSuccess("Updated member automation.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-preview-onboarding-prompt",
    {
      title: "Preview Golutra onboarding prompt",
      description:
        `Preview the built-in or rendered initial prompt for one member role and token context. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        memberId: z.string().trim().optional(),
        roleType: promptRoleTypeSchema.optional(),
        collaborationMode: z.boolean().optional(),
        selectedSkillPaths: stringArraySchema.optional(),
        soloDocumentPath: z.string().trim().optional(),
        language: z.string().trim().optional(),
        template: z.string().optional()
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const workspacePath = contextStore.resolveCommandContext(input).workspacePath;
        const result = await gateway.previewOnboardingPrompt(runtimeContext, {
          ...(workspacePath ? { workspacePath } : {}),
          ...(input.memberId ? { memberId: input.memberId } : {}),
          ...(input.roleType ? { roleType: input.roleType } : {}),
          ...(typeof input.collaborationMode === "boolean"
            ? { collaborationMode: input.collaborationMode }
            : {}),
          ...(input.selectedSkillPaths
            ? { selectedSkillPaths: input.selectedSkillPaths }
            : {}),
          ...(input.soloDocumentPath
            ? { soloDocumentPath: input.soloDocumentPath }
            : {}),
          ...(input.language ? { language: input.language } : {}),
          ...(input.template !== undefined ? { template: input.template } : {})
        });
        return buildToolSuccess("Previewed onboarding prompt.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-restart-member",
    {
      title: "Restart a Golutra member terminal",
      description:
        `Restart one member terminal after the user confirms the exact memberId and memberName. Use this after changing initial prompts when the running session should pick them up. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        memberId: nonEmptyString,
        memberName: nonEmptyString,
        launchReason: z.string().trim().optional(),
        ownerWindowLabel: z.string().trim().optional(),
        forceClose: z.boolean().optional(),
        hardClose: z.boolean().optional(),
        timeoutMs: optionalTimeout
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.restartMember(runtimeContext, {
          workspacePath,
          memberId: input.memberId,
          ...(input.launchReason ? { launchReason: input.launchReason } : {}),
          ...(input.ownerWindowLabel
            ? { ownerWindowLabel: input.ownerWindowLabel }
            : {}),
          ...(typeof input.forceClose === "boolean"
            ? { forceClose: input.forceClose }
            : {}),
          ...(typeof input.hardClose === "boolean" ? { hardClose: input.hardClose } : {}),
          ...(typeof input.timeoutMs === "number" ? { timeoutMs: input.timeoutMs } : {})
        });
        return buildToolSuccess(`Restarted member ${input.memberName}.`, result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-list-skills",
    {
      title: "List Golutra CLI skills",
      description:
        `List built-in golutra-cli skills and optionally append workspace project skills. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const workspacePath = runtimeContext.workspacePath;
        const result = await gateway.listSkills(runtimeContext, {
          ...(workspacePath ? { workspacePath } : {})
        });
        return buildToolSuccess("Listed skills.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-get-skill",
    {
      title: "Get Golutra CLI skill detail",
      description: "Read the detailed schema for a built-in golutra-cli skill.",
      inputSchema: {
        skillName: z.string().trim().min(1),
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.getSkill(runtimeContext, input.skillName);
        return buildToolSuccess(`Loaded skill ${input.skillName}.`, result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-validate-skill",
    {
      title: "Validate a Golutra skill directory",
      description:
        "Run golutra-cli skill-validate against a local skill directory that contains SKILL.md.",
      inputSchema: {
        skillPath: z.string().trim().min(1),
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.validateSkill(runtimeContext, input.skillPath);
        return buildToolSuccess("Validated skill.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-list-project-skills",
    {
      title: "List Golutra project skills",
      description:
        `List only workspace-resolved project skills discovered from .golutra/skills. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.listSkills(runtimeContext, { workspacePath });
        return buildToolSuccess("Listed project skills.", {
          projectSkillsRoot: result.projectSkillsRoot,
          projectSkills: result.projectSkills ?? [],
          projectSkillsNote: result.projectSkillsNote
        });
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-link-project-skill",
    {
      title: "Link a Golutra project skill",
      description:
        `Link one personal skill library folder into the current workspace project skill set. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        skillFolderName: nonEmptyString
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.linkProjectSkill(runtimeContext, {
          workspacePath,
          skillFolderName: input.skillFolderName
        });
        return buildToolSuccess("Linked project skill.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-read-project-skill",
    {
      title: "Read a Golutra project skill document",
      description:
        `Discover a workspace project skill by name and return its SKILL.md content. ${workspaceOverrideNote}`,
      inputSchema: {
        skillName: z.string().trim().min(1),
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const skills = await gateway.listSkills(runtimeContext, { workspacePath });
        const projectSkill = findProjectSkillByName(skills, input.skillName);
        const result = await readProjectSkillDocument(projectSkill);
        return buildToolSuccess(`Read project skill ${input.skillName}.`, result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-list-skill-library",
    {
      title: "List Golutra skill library",
      description: "List reusable personal skill-library entries.",
      inputSchema: {
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.listSkillsLibrary(runtimeContext);
        return buildToolSuccess("Listed skill library.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-create-skill-library-entry",
    {
      title: "Create a Golutra skill library entry",
      description:
        "Scaffold one local skill template folder. Edit and validate the generated skill before linking it into a workspace.",
      inputSchema: {
        profile: optionalProfile,
        folderName: nonEmptyString,
        displayName: z.string().trim().optional()
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.createSkillLibraryEntry(runtimeContext, {
          folderName: input.folderName,
          ...(input.displayName ? { displayName: input.displayName } : {})
        });
        return buildToolSuccess("Created skill library entry.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-import-skill-library-entries",
    {
      title: "Import Golutra skill library entries",
      description: "Import one or more existing local skill folders into the personal skill library.",
      inputSchema: {
        profile: optionalProfile,
        sourcePaths: stringArraySchema.min(1)
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.importSkillLibraryEntries(runtimeContext, {
          sourcePaths: input.sourcePaths
        });
        return buildToolSuccess("Imported skill library entries.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-list-agents",
    {
      title: "List Golutra agent templates",
      description: "List local agent repository templates that can be bound to project members.",
      inputSchema: {
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.listAgentsRepository(runtimeContext);
        return buildToolSuccess("Listed agent templates.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-create-agent",
    {
      title: "Create a Golutra agent template",
      description:
        "Create one local agent template. roleSettingBody should contain only the agent role description body; Golutra generates the fixed template structure.",
      inputSchema: {
        profile: optionalProfile,
        folderName: nonEmptyString,
        displayName: nonEmptyString,
        summary: nonEmptyString,
        roleSettingBody: z.string().optional(),
        packageId: z.string().trim().optional()
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.createAgentRepositoryEntry(runtimeContext, {
          folderName: input.folderName,
          displayName: input.displayName,
          summary: input.summary,
          ...(input.roleSettingBody !== undefined
            ? { roleSettingBody: input.roleSettingBody }
            : {}),
          ...(input.packageId ? { packageId: input.packageId } : {})
        });
        return buildToolSuccess("Created agent template.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-inspect-template",
    {
      title: "Inspect a Golutra template",
      description: "Preview one local .gfriend.zip file or repository source path.",
      inputSchema: {
        profile: optionalProfile,
        filePath: nonEmptyString
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.inspectFriendTemplate(runtimeContext, {
          filePath: input.filePath
        });
        return buildToolSuccess("Inspected template.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-list-template-repository",
    {
      title: "List Golutra template repository",
      description: "List My Templates repository cards.",
      inputSchema: {
        profile: optionalProfile
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.listFriendTemplateRepository(runtimeContext);
        return buildToolSuccess("Listed template repository.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-use-template-repository-card",
    {
      title: "Use a Golutra template repository card",
      description:
        `Apply one My Templates repository card to a workspace. This is the front-end repository-card Use semantic, not generic external import. ${workspaceOverrideNote}`,
      inputSchema: {
        workspacePath: optionalWorkspacePath,
        profile: optionalProfile,
        fileName: z.string().trim().optional(),
        filePath: z.string().trim().optional(),
        mode: z.string().trim().optional(),
        terminalOverrides: z.array(z.unknown()).optional(),
        projectSettings: optionalJsonObject
      }
    },
    async (input) => {
      try {
        const workspacePath = contextStore.requireWorkspacePath(input);
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.useFriendTemplateRepository(runtimeContext, {
          workspacePath,
          ...(input.fileName ? { fileName: input.fileName } : {}),
          ...(input.filePath ? { filePath: input.filePath } : {}),
          ...(input.mode ? { mode: input.mode } : {}),
          ...(input.terminalOverrides
            ? { terminalOverrides: input.terminalOverrides }
            : {}),
          ...(input.projectSettings ? { projectSettings: input.projectSettings } : {})
        });
        return buildToolSuccess("Used template repository card.", result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );

  server.registerTool(
    "golutra-store-command",
    {
      title: "Run a Golutra store command",
      description:
        "Run one supported store.* structured command. Use store assets only after the user explicitly approves store usage.",
      inputSchema: {
        profile: optionalProfile,
        commandType: storeCommandTypeSchema,
        payload: z.record(z.unknown()).default({})
      }
    },
    async (input) => {
      try {
        const runtimeContext = contextStore.resolveCommandContext(input);
        const result = await gateway.executeStoreCommand(
          runtimeContext,
          input.commandType,
          input.payload
        );
        return buildToolSuccess(`Ran ${input.commandType}.`, result);
      } catch (error) {
        return buildToolError(error);
      }
    }
  );
}
