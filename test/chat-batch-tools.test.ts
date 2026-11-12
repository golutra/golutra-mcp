import { describe, expect, it, vi } from "vitest";
import { batchMessagesSchema, chatSendSchema, chatInboxSchema, registerChatBatchTools } from "../src/lib/chat-batch-tools.js";
import { ContextStore } from "../src/lib/context.js";
import { GolutraCliGateway } from "../src/lib/golutra-client.js";
import type { CliCommandRequest, ChatBatchResult } from "../src/lib/types.js";

const info = { ok: true, capabilities: ["chatSendDraft", "chatRetryFile", "chatInboxAllPages", "chatRetryDiagnostic"] };
const context = {cliPath:"/build/golutra-cli", profile:"dev" as const, timeoutMs:1000};

describe("batch messaging contract", () => {
  it("accepts mixed destinations and rejects ambiguous routes, duplicate keys and oversize keys", () => {
    const privateMessage = { key: "a", text: "hello", to: { memberId: "b" } };
    expect(batchMessagesSchema.safeParse([privateMessage, { key: "c", text: "reply", replyTo: "message" }]).success).toBe(true);
    for (const messages of [[{key: "bad", text: "hello", to: {conversationId: "c", mentionIds: ["all"]}}], [{key: "empty", text: "hello", to: {conversationId: "c", mentionIds: []}}], [privateMessage, privateMessage], [{ ...privateMessage, replyTo: "message" }], [{ ...privateMessage, key: "中".repeat(43) }]]) {
      expect(batchMessagesSchema.safeParse(messages).success).toBe(false);
    }
  });

  it("preserves retry identity, source text and per-item failures through one CLI submission", async () => {
    const result: ChatBatchResult = { requestId: "retry-stable", accepted: 1, duplicates: 0, failed: 1, items: [
      { key: "a", status: "queued", enqueued: 1, messageId: "new" },
      { key: "b", status: "failed", enqueued: 0, error: "unknown member" }
    ] };
    const envelope = { ok: true, result: { status: "ok", data: result }, retryFile:"/saved/request.json" };
    const executeJson = vi.fn().mockResolvedValueOnce(info).mockResolvedValue(envelope);
    const gateway = new GolutraCliGateway({ executeJson });
    const tools = new Map<string, (input: never) => Promise<unknown>>();
    registerChatBatchTools({ registerTool: (name: string, _: unknown, handler: (input: never) => Promise<unknown>) => tools.set(name, handler) } as never,
      new ContextStore(context), gateway);
    const messages = [ { key:"a", text:"  exact\n--help", to:{memberId:"one"} }, { key:"b", text:"reply", replyTo:"source" } ];
    const response = await tools.get("golutra-send-messages")!({requestId:"retry-stable", messages} as never);
    expect(response).toMatchObject({isError:true, structuredContent:envelope});
    expect(executeJson).toHaveBeenCalledTimes(2);
    const request = executeJson.mock.calls[1]![0] as CliCommandRequest;
    expect(request.args).toEqual(["--profile","dev","chat","send","--stdin","--timeout-ms","1000"]);
    expect(request.timeoutMs).toBe(3500);
    expect(JSON.parse(request.stdin!)).toEqual({requestId:"retry-stable",messages});
  });

  it("delegates the current inbox and all pagination to the CLI without manufacturing identity", async () => {
    const executeJson = vi.fn().mockResolvedValueOnce(info).mockResolvedValue({ ok:true, result:{status:"ok",data:{batchId:"frozen",complete:true,nextCursor:null}} });
    const gateway = new GolutraCliGateway({executeJson});
    expect(await gateway.readInbox(context, {})).toMatchObject({batchId:"frozen",complete:true});
    const request = executeJson.mock.calls[1]![0] as CliCommandRequest;
    expect(request.args).toEqual(["--profile","dev","chat","inbox","--stdin","--timeout-ms","1000"]);
    expect(JSON.parse(request.stdin!)).toEqual({});
    expect(chatInboxSchema.safeParse({}).success).toBe(true);
    expect(chatInboxSchema.safeParse({cursor:32}).success).toBe(false);
  });

  it("accepts concise sends and rejects mixed send/retry modes before submission", () => {
    for (const value of [{text:"reply"},{messages:[{text:"one"},{text:"two",replyTo:"source"}]},{retryFile:"/previous.json"}]) {
      expect(chatSendSchema.safeParse(value).success).toBe(true);
    }
    for (const value of [{}, {text:" "}, {text:"hello",messages:[{text:"two"}]}, {retryFile:"/saved",text:"changed"}, {retryFile:"/saved",senderId:"other"}, {messages:[{text:"one"}],replyTo:"outside"}]) {
      expect(chatSendSchema.safeParse(value).success).toBe(false);
    }
  });

  it("retries the saved request without rebuilding its text or target and caches capability checks", async () => {
    const executeJson = vi.fn().mockResolvedValueOnce(info).mockResolvedValue({ok:true,result:{status:"ok",data:{failed:0}}});
    const gateway = new GolutraCliGateway({executeJson});
    await gateway.sendMessages(context,{text:"hello"});
    const retryFile = "/a b/it's $x` request.json";
    await gateway.retryMessages(context,retryFile);
    expect(executeJson).toHaveBeenCalledTimes(3);
    const request = executeJson.mock.calls[2]![0] as CliCommandRequest;
    expect(request.args).toEqual(["--profile","dev","chat","send","--retry",retryFile,"--timeout-ms","1000"]);
    expect(request.stdin).toBeUndefined();
  });

  it("rejects an old CLI before sending and rechecks after the program is updated", async () => {
    const executeJson = vi.fn().mockResolvedValueOnce({ok:true,capabilities:["structuredStdin"]}).mockResolvedValueOnce(info).mockResolvedValue({ok:true});
    const gateway = new GolutraCliGateway({executeJson});
    await expect(gateway.sendMessages(context,{text:"hello"})).rejects.toMatchObject({code:"CLI_CHAT_CAPABILITY_REQUIRED"});
    expect(executeJson).toHaveBeenCalledTimes(1);
    await gateway.sendMessages(context,{text:"hello"});
    expect(executeJson).toHaveBeenCalledTimes(3);
  });

  it("does not present an incomplete CLI inbox as complete", async () => {
    const executeJson = vi.fn().mockResolvedValueOnce(info).mockResolvedValue({ok:true,result:{status:"ok",data:{complete:false,nextCursor:32}}});
    const gateway = new GolutraCliGateway({executeJson});
    await expect(gateway.readInbox(context,{})).rejects.toThrow("CLI_INBOX_INCOMPLETE");
  });

  it("does not inject a newly selected workspace into a saved retry", async () => {
    const retryMessages = vi.fn().mockResolvedValue({ok:true,retryFile:"/original.json",result:{status:"ok",data:{failed:0}}});
    const tools = new Map<string, (input: never) => Promise<unknown>>();
    registerChatBatchTools({registerTool:(name:string,_:unknown,handler:(input:never)=>Promise<unknown>)=>tools.set(name,handler)} as never,
      new ContextStore({...context,workspacePath:"/new-workspace"}),{retryMessages} as never);
    const response = await tools.get("golutra-send-messages")!({retryFile:"/original.json"} as never);
    expect(response).not.toHaveProperty("isError");
    expect(retryMessages.mock.calls[0]?.[1]).toBe("/original.json");
    expect(retryMessages.mock.calls[0]?.length).toBe(2);
  });
});
