import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ContextStore } from "./context.js";
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
      const diagnosis: Record<string, unknown> = {
        context: runtimeContext,
        checks: {
          cli: {
            ok: false
          },
          app: {
            ok: false,
            skipped: true
          }
        }
      };

      try {
        const skills = await gateway.listSkills(runtimeContext, {});
        diagnosis.checks = {
          ...(diagnosis.checks as Record<string, unknown>),
          cli: {
            ok: true,
            builtInSkillNames: Object.keys(skills.skills ?? {})
          }
        };
      } catch (error) {
        diagnosis.checks = {
          ...(diagnosis.checks as Record<string, unknown>),
          cli: {
            ok: false,
            error: buildToolError(error).structuredContent
          }
        };
        return buildToolSuccess("Golutra diagnosis completed.", diagnosis);
      }

      const workspacePath = runtimeContext.workspacePath;
      if (!workspacePath || !input.userId) {
        diagnosis.checks = {
          ...(diagnosis.checks as Record<string, unknown>),
          app: {
            ok: false,
            skipped: true,
            reason:
              "workspacePath and userId are both required for an app-backed chat.conversations.list probe."
          }
        };
        return buildToolSuccess("Golutra diagnosis completed.", diagnosis);
      }

      try {
        const conversations = await gateway.listConversations(runtimeContext, {
          workspacePath,
          userId: input.userId
        });
        diagnosis.checks = {
          ...(diagnosis.checks as Record<string, unknown>),
          app: {
            ok: true,
            skipped: false,
            channelCount: Array.isArray(conversations.channels)
              ? conversations.channels.length
              : 0,
            defaultChannelId: conversations.defaultChannelId
          }
        };
      } catch (error) {
        diagnosis.checks = {
          ...(diagnosis.checks as Record<string, unknown>),
          app: {
            ok: false,
            skipped: false,
            error: buildToolError(error).structuredContent
          }
        };
      }

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
        mentionIds: z.array(z.string().trim().min(1)).min(1),
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
