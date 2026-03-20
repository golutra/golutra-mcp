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
        "Update the default golutra-cli path, profile, workspace path, or timeout for later tool calls.",
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
        "Check whether golutra-cli is callable and, when workspacePath and userId are available, whether the running Golutra app accepts workspace-scoped commands.",
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

      checks.userId = inspectUserId(input.userId);
      if (!checks.userId.ok) {
        nextStepGroups.push([
          "Pass a workspace member userId to golutra-diagnose to run the app-backed chat probe."
        ]);
        checks.appConnection = buildSkippedAppProbe(
          "APP_PROBE_SKIPPED",
          "App-backed diagnostic probe was skipped because userId was not provided."
        );
        const diagnosis = {
          context: runtimeContext,
          checks,
          summary: summarizeDiagnosis(toDiagnosisRecord(checks)),
          nextSteps: mergeNextSteps(nextStepGroups)
        };
        return buildToolSuccess("Golutra diagnosis completed.", diagnosis);
      }

      try {
        const conversations = await gateway.listConversations(runtimeContext, {
          workspacePath: runtimeContext.workspacePath as string,
          userId: input.userId as string
        });
        checks.appConnection = {
          ok: true,
          skipped: false,
          probe: "chat.conversations.list",
          channelCount: Array.isArray(conversations.channels)
            ? conversations.channels.length
            : 0,
          directCount: Array.isArray(conversations.directs)
            ? conversations.directs.length
            : 0,
          defaultChannelId: conversations.defaultChannelId
        };
      } catch (error) {
        const appProbe = classifyAppProbeFailure(error, runtimeContext);
        checks.appConnection = {
          ...appProbe,
          probe: "chat.conversations.list"
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
    "golutra-list-conversations",
    {
      title: "List Golutra conversations",
      description:
        "List channel and direct-message conversations visible to a workspace member.",
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
        "Read recent messages from a Golutra channel or direct conversation.",
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
        "Send a Golutra chat message through golutra-cli using a structured chat.send payload.",
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
        "Read the workspace roadmap or a conversation-specific roadmap through golutra-cli.",
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
        "Replace the current workspace or conversation roadmap through golutra-cli.",
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
    "golutra-list-skills",
    {
      title: "List Golutra CLI skills",
      description:
        "List built-in golutra-cli skills and optionally append workspace project skills.",
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
        "List only workspace-resolved project skills discovered from .golutra/skills.",
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
    "golutra-read-project-skill",
    {
      title: "Read a Golutra project skill document",
      description:
        "Discover a workspace project skill by name and return its SKILL.md content.",
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
}
