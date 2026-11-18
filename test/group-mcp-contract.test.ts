import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerTools } from "../src/lib/toolkit.js";
import { ContextStore } from "../src/lib/context.js";
import { GolutraCliGateway } from "../src/lib/golutra-client.js";
import type { CliJsonRunner } from "../src/lib/cli-runner.js";

describe("group collaboration through MCP", () => {
  it("preserves external addresses through SDK validation without switching the caller workspace", async () => {
    const server = new McpServer({ name: "external-group-contract", version: "1" });
    const executeJson = vi.fn<CliJsonRunner["executeJson"]>().mockResolvedValueOnce({
      ok: true,
      capabilities: ["chatSendDraft", "chatRetryFile", "chatInboxAllPages", "chatRetryDiagnostic", "chatCrossWorkspace", "chatCrossWorkspaceChannels"],
      host: { capabilities: ["chatCrossWorkspaceChannels"] }
    }).mockResolvedValue({ ok: true, result: { status: "ok", data: {} } });
    const workspacePath = "/workspaces/caller";
    const store = new ContextStore({ cliPath: "/build/golutra-cli", profile: "dev", timeoutMs: 1000, workspacePath });
    registerTools(server, store, new GolutraCliGateway({ executeJson }));
    const client = new Client({ name: "external-group-contract-client", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const externalMembers = [{ workspaceId: "workspace-b", memberId: "member-b" }];
    try {
      await server.connect(st); await client.connect(ct);
      expect((await client.callTool({ name: "golutra-create-channel", arguments: { customName: "跨区群", externalMembers } })).isError).not.toBe(true);
      expect((await client.callTool({ name: "golutra-add-channel-members", arguments: { workspaceId: "workspace-a", conversationId: "group-a", externalMembers } })).isError).not.toBe(true);
      expect((await client.callTool({ name: "golutra-list-messages", arguments: { workspaceId: "workspace-a", conversationId: "group-a", limit: 20 } })).isError).not.toBe(true);
      expect(executeJson.mock.calls.slice(1).map(([request]) => JSON.parse(request.stdin ?? "{}") as unknown)).toEqual([
        { type: "chat.channel.create", payload: { workspacePath, customName: "跨区群", memberIds: [], externalMembers } },
        { type: "chat.channel.members.add", payload: { workspacePath, workspaceId: "workspace-a", conversationId: "group-a", memberIds: [], externalMembers } },
        { type: "chat.messages.list", payload: { workspacePath, workspaceId: "workspace-a", conversationId: "group-a", limit: 20 } }
      ]);
      const context = await client.callTool({ name: "golutra-get-context", arguments: {} });
      expect(context.structuredContent).toMatchObject({ workspacePath, profile: "dev" });
      expect((await client.callTool({ name: "golutra-create-channel", arguments: { customName: "没有成员" } })).isError).toBe(true);
      expect((await client.callTool({ name: "golutra-add-channel-members", arguments: { conversationId: "group-a", externalMembers: [{ memberId: "member-b" }] } })).isError).toBe(true);
      expect(executeJson).toHaveBeenCalledTimes(4);
    } finally { await client.close(); await server.close(); }
  });

  it("allows minimal inputs through SDK validation and sends one atomic command to CLI", async () => {
    const server = new McpServer({ name: "group-contract", version: "1" });
    const executeJson = vi.fn<CliJsonRunner["executeJson"]>().mockResolvedValue({
      ok: true, result: { status: "ok", data: { conversationId: "group", addedMemberIds: ["b"] } }
    });
    registerTools(server, new ContextStore({ cliPath: "/build/golutra-cli", profile: "dev", timeoutMs: 1000 }), new GolutraCliGateway({ executeJson }));
    const client = new Client({ name: "group-contract-client", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(st); await client.connect(ct);
      const definitions = (await client.listTools()).tools;
      for (const name of ["golutra-list-conversations", "golutra-create-channel", "golutra-add-channel-members"]) {
        const tool = definitions.find(value => value.name === name)!;
        expect(tool.inputSchema.required ?? []).not.toContain("userId");
        expect(tool.inputSchema.required ?? []).not.toContain("workspacePath");
      }
      expect((await client.callTool({ name: "golutra-list-conversations", arguments: {} })).isError).not.toBe(true);
      expect((await client.callTool({ name: "golutra-create-channel", arguments: { customName: "中文群", memberIds: ["a"] } })).isError).not.toBe(true);
      expect((await client.callTool({ name: "golutra-add-channel-members", arguments: { conversationId: "group", memberIds: ["b"] } })).isError).not.toBe(true);
      expect(executeJson.mock.calls.map(([request]) => JSON.parse(request.stdin ?? "{}") as unknown)).toEqual([
        { type: "chat.conversations.list", payload: {} },
        { type: "chat.channel.create", payload: { customName: "中文群", memberIds: ["a"] } },
        { type: "chat.channel.members.add", payload: { conversationId: "group", memberIds: ["b"] } }
      ]);
      expect((await client.callTool({ name: "golutra-add-channel-members", arguments: { conversationId: "group", memberIds: [] } })).isError).toBe(true);
      expect(executeJson).toHaveBeenCalledTimes(3);
      executeJson.mockResolvedValueOnce({ ok: false, error: "CHAT_CONVERSATION_ACCESS_DENIED" });
      expect((await client.callTool({ name: "golutra-add-channel-members", arguments: { conversationId: "private", memberIds: ["b"] } })).isError).toBe(true);
      expect(executeJson).toHaveBeenCalledTimes(4);
    } finally { await client.close(); await server.close(); }
  });
});
