import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ContextStore } from "./context.js";
import type { GolutraCliGateway } from "./golutra-client.js";
import { buildToolError, buildToolSuccess } from "./tool-results.js";

const id = z.string().trim().min(1);
const retryKey = id.refine(value => Buffer.byteLength(value, "utf8") <= 128, "Must not exceed 128 UTF-8 bytes");
const mentions = z.array(id).min(1).refine(values => values.every(value => value.toLowerCase() !== "all"), "mentionIds does not allow all");
export const batchMessageSchema = z.object({
  key: retryKey,
  text: z.string().min(1).refine(value => value.trim().length > 0, "text is required"),
  to: z.union([
    z.object({ memberId: id }).strict(),
    z.object({ conversationId: id, mentionIds: mentions }).strict()
  ]).optional(),
  replyTo: id.optional()
}).strict().refine(value => Boolean(value.to) !== Boolean(value.replyTo), "Use exactly one of to or replyTo");

export const batchMessagesSchema = z.array(batchMessageSchema).min(1).max(128)
  .refine(messages => new Set(messages.map(message => message.key)).size === messages.length, "Message keys must be unique within the batch");

export function registerChatBatchTools(server: McpServer, contextStore: ContextStore, gateway: GolutraCliGateway): void {
  server.registerTool("golutra-send-messages", {
    title: "Send a batch of Golutra messages and replies",
    description: "Writes workspace. Preferred messaging tool: send up to 128 private/channel messages or replies in one synchronous queue submission. The Host infers member identity when verifiable; local operators must supply senderId and workspacePath. Inspect every items[].status; queued means accepted, not model completion. Partial failures keep successful items. Retry unchanged failed/uncertain items with the same requestId and key; changed content requires a new key. Never auto-retry across runtimes.",
    inputSchema: {
      requestId: retryKey, messages: batchMessagesSchema, senderId: id.optional(),
      workspacePath: id.optional(), profile: z.enum(["dev", "canary", "stable"]).optional()
    }
  }, async input => {
    try {
      const context = contextStore.resolveCommandContext(input);
      const result = await gateway.sendMessages(context, {
        requestId: input.requestId, messages: input.messages,
        senderId: input.senderId, workspacePath: context.workspacePath
      });
      // 批次接收成功不能掩盖逐项失败；保留所有原始结果供 Agent 精确重试。
      const response = buildToolSuccess("Batch processed. Inspect each item; queue acceptance is not a model reply.", result);
      return result.failed > 0 ? { ...response, isError: true } : response;
    } catch (error) { return buildToolError(error); }
  });

  server.registerTool("golutra-read-inbox", {
    title: "Read the current member's frozen inbox",
    description: "Read-only. Read chat.inbox.read for GOLUTRA_INBOX. Start cursor=0 and follow nextCursor until complete=true; handle the complete frozen list in the same TUI turn. Access is restricted to the recipient member. Preserve original message IDs and route answers with replyTo.",
    inputSchema: {
      batchId: id, cursor: z.number().int().nonnegative().optional(), senderId: id.optional(),
      workspacePath: id.optional(), profile: z.enum(["dev", "canary", "stable"]).optional()
    }
  }, async input => {
    try {
      const context = contextStore.resolveCommandContext(input);
      return buildToolSuccess("Frozen inbox page. Follow nextCursor until complete=true.", await gateway.readInbox(context, {
        batchId: input.batchId, cursor: input.cursor, senderId: input.senderId, workspacePath: context.workspacePath
      }));
    } catch (error) { return buildToolError(error); }
  });
}
