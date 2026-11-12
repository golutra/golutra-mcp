import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ContextStore } from "./context.js";
import type { GolutraCliGateway } from "./golutra-client.js";
import { buildToolError, buildToolSuccess } from "./tool-results.js";

const id = z.string().trim().min(1);
const retryKey = id.refine(value => Buffer.byteLength(value, "utf8") <= 128, "Must not exceed 128 UTF-8 bytes");
const mentions = z.array(id).min(1).refine(values => values.every(value => value.toLowerCase() !== "all"), "mentionIds does not allow all");
const messageShape = {
  text: z.string().min(1).refine(value => value.trim().length > 0, "text is required"),
  to: z.union([
    z.object({ memberId: id }).strict(),
    z.object({ conversationId: id, mentionIds: mentions }).strict()
  ]).optional(),
  replyTo: id.optional(),
  key: retryKey.optional().describe("Normally omitted. Supply only when requested by a specific CLI error.")
};

export const batchMessageSchema = z.object(messageShape).strict()
  .refine(value => !(value.to && value.replyTo), "Use to or replyTo, never both");

export const batchMessagesSchema = z.array(batchMessageSchema).min(1).max(128)
  .refine(messages => {
    const keys = messages.flatMap(message => message.key ? [message.key] : []);
    return new Set(keys).size === keys.length;
  }, "Explicit message keys must be unique within the batch");

const contextShape = {
  senderId: id.optional().describe("Only supply your own member identity if the CLI requests it."),
  workspacePath: id.optional(),
  profile: z.enum(["dev", "canary", "stable"]).optional()
};

const chatSendInputSchema = z.object({
  ...messageShape,
  text: messageShape.text.optional(),
  messages: batchMessagesSchema.optional(),
  retryFile: z.string().min(1).optional().describe("Retry using the file returned by the previous send; do not resubmit its text."),
  requestId: retryKey.optional().describe("Normally omitted. Supply only if requested outside an active turn or for an intentional repeat."),
  batchId: id.optional().describe("Normally omitted; the Host verifies the active inbox."),
  ...contextShape
}).strict();

// MCP SDK 只从对象 schema 生成工具参数；跨字段校验留给调用边界，避免工具列表变成空对象。
export const chatSendSchema = chatSendInputSchema.superRefine((value, ctx) => {
  const modes = [value.text, value.messages, value.retryFile].filter(item => item !== undefined).length;
  if (modes !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide exactly one of text, messages or retryFile" });
  }
  if (value.to && value.replyTo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use to or replyTo, never both" });
  }
  if (!value.text && (value.to || value.replyTo || value.key)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Put each destination or reply source inside messages" });
  }
  if (value.retryFile && [value.requestId, value.batchId, value.senderId, value.workspacePath].some(item => item !== undefined)) {
    // 重试仅使用磁盘上的原请求，不能由当前会话默认值重新生成身份、来源或目标。
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "retryFile already contains the original request; omit requestId, batchId, senderId and workspacePath" });
  }
});

export const chatInboxSchema = z.object({
  batchId: id.optional().describe("Normally omitted. Use a specific frozen inbox only when needed."),
  ...contextShape
}).strict();

export function registerChatBatchTools(server: McpServer, contextStore: ContextStore, gateway: GolutraCliGateway): void {
  server.registerTool("golutra-send-messages", {
    title: "Send Golutra messages and replies",
    description: "Writes workspace. Send text for one message, or messages for up to 128 ready messages. The CLI fills verified identity and the unique current reply source; add to or replyTo when needed. Only supply other context if an error requests it. Inspect result.data.items; queued means accepted, not model completion. For timeout or partial failure, call this tool with the returned retryFile and the same profile/Host. Failures retain the original CLI JSON in response and expose retryFile when available. Never resubmit short input to retry an earlier turn or switch runtimes. Read chat help only when unclear.",
    inputSchema: chatSendInputSchema
  }, async input => {
    try {
      const { profile, retryFile, ...draft } = chatSendSchema.parse(input);
      const context = contextStore.resolveCommandContext({ profile, workspacePath: draft.workspacePath });
      const response = retryFile
        ? await gateway.retryMessages(context, retryFile)
        : await gateway.sendMessages(context, { ...draft, workspacePath: context.workspacePath });
      const result = buildToolSuccess("Inspect each item; queue acceptance is not a model reply. Keep retryFile for retries.", response);
      const data = response.result?.data as { failed?: number } | undefined;
      return !response.ok || response.result?.status !== "ok" || (data?.failed ?? 0) > 0
        ? { ...result, isError: true } : result;
    } catch (error) { return buildToolError(error); }
  });

  server.registerTool("golutra-read-inbox", {
    title: "Read all messages in the current member's inbox",
    description: "Read-only. Usually call with no arguments: the Host verifies the member and current frozen inbox, and the CLI reads every page. Use original messageId as replyTo for multiple sources. Do not pass cursor or infer identity from names. Only add missing context if an error requests it.",
    inputSchema: chatInboxSchema
  }, async input => {
    try {
      const { profile, ...read } = chatInboxSchema.parse(input);
      const context = contextStore.resolveCommandContext({ profile, workspacePath: read.workspacePath });
      return buildToolSuccess("Complete frozen inbox. Reply to each relevant original messageId.", await gateway.readInbox(context, {
        ...read, workspacePath: context.workspacePath
      }));
    } catch (error) { return buildToolError(error); }
  });
}
