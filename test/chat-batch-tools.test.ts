import { describe, expect, it, vi } from "vitest";
import { batchMessagesSchema, registerChatBatchTools } from "../src/lib/chat-batch-tools.js";
import { ContextStore } from "../src/lib/context.js";
import { GolutraCliGateway } from "../src/lib/golutra-client.js";
import type { CliCommandRequest, ChatBatchResult } from "../src/lib/types.js";

describe("batch messaging contract", () => {
  it("accepts mixed destinations and rejects ambiguous routes, duplicate keys and oversize keys", () => {
    const privateMessage = { key: "a", text: "hello", to: { memberId: "b" } };
    expect(batchMessagesSchema.safeParse([privateMessage, { key: "c", text: "reply", replyTo: "message" }]).success).toBe(true);
    for (const messages of [[privateMessage, privateMessage], [{ ...privateMessage, replyTo: "message" }], [{ ...privateMessage, key: "中".repeat(43) }]]) {
      expect(batchMessagesSchema.safeParse(messages).success).toBe(false);
    }
  });

  it("preserves retry identity, source text and per-item failures through one CLI submission", async () => {
    const result: ChatBatchResult = { requestId: "retry-stable", accepted: 1, duplicates: 0, failed: 1, items: [
      { key: "a", status: "queued", enqueued: 1, messageId: "new" },
      { key: "b", status: "failed", enqueued: 0, error: "unknown member" }
    ] };
    const executeJson = vi.fn().mockResolvedValue({ ok: true, result: { status: "ok", data: result } });
    const gateway = new GolutraCliGateway({ executeJson });
    const tools = new Map<string, (input: never) => Promise<unknown>>();
    registerChatBatchTools({ registerTool: (name: string, _: unknown, handler: (input: never) => Promise<unknown>) => tools.set(name, handler) } as never,
      new ContextStore({cliPath:"golutra-cli", profile:"dev", timeoutMs:1000}), gateway);
    const messages = [ { key:"a", text:"  exact\n--help", to:{memberId:"one"} }, { key:"b", text:"reply", replyTo:"source" } ];
    const response = await tools.get("golutra-send-messages")!({requestId:"retry-stable", messages} as never);
    expect(response).toMatchObject({isError:true, structuredContent:result});
    expect(executeJson).toHaveBeenCalledTimes(1);
    const request = executeJson.mock.calls[0]![0] as CliCommandRequest;
    expect(request.args).toEqual(["--profile","dev","run","--stdin","--timeout-ms","1000"]);
    expect(JSON.parse(request.stdin!)).toEqual({type:"chat.send.batch",payload:{requestId:"retry-stable",messages}});
  });

  it("passes the frozen inbox cursor and does not manufacture sender identity", async () => {
    const executeJson = vi.fn().mockResolvedValue({ ok:true, result:{status:"ok",data:{batchId:"frozen",complete:false,nextCursor:32}} });
    const gateway = new GolutraCliGateway({executeJson});
    await gateway.readInbox({cliPath:"golutra-cli",timeoutMs:1000},{batchId:"frozen",cursor:0});
    expect(JSON.parse((executeJson.mock.calls[0]![0] as CliCommandRequest).stdin!)).toEqual({type:"chat.inbox.read",payload:{batchId:"frozen",cursor:0}});
  });
});
