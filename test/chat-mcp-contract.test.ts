import {describe,expect,it,vi} from "vitest";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";
import {registerChatBatchTools} from "../src/lib/chat-batch-tools.js";
import {ContextStore} from "../src/lib/context.js";

describe("MCP chat protocol",()=>{
  it("advertises concise fields and validates mixed modes through the real SDK",async()=>{
    const server=new McpServer({name:"chat-contract",version:"1"});
    const sendMessages=vi.fn().mockResolvedValue({ok:true,retryFile:"/saved.json",result:{status:"ok",data:{failed:0,items:[]}}});
    const readInbox=vi.fn().mockResolvedValue({complete:true,nextCursor:null,messages:[]});
    registerChatBatchTools(server,new ContextStore({cliPath:"/build/golutra-cli",profile:"dev",timeoutMs:1000}),{sendMessages,readInbox} as never);
    const client=new Client({name:"chat-contract-client",version:"1"});
    const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
    try{
      await server.connect(serverTransport);await client.connect(clientTransport);
      const tools=(await client.listTools()).tools;
      const send=tools.find(tool=>tool.name==="golutra-send-messages")!;
      expect(send.inputSchema.properties).toHaveProperty("text");
      expect(send.inputSchema.properties).toHaveProperty("messages");
      expect(send.inputSchema.properties).toHaveProperty("retryFile");
      expect(send.inputSchema.required??[]).not.toContain("requestId");
      expect(send.inputSchema.required??[]).not.toContain("messages");
      const invalid=await client.callTool({name:send.name,arguments:{text:"one",messages:[{text:"two"}]}});
      expect(invalid.isError).toBe(true);expect(sendMessages).not.toHaveBeenCalled();
      const valid=await client.callTool({name:send.name,arguments:{text:"one"}});
      expect(valid.isError).not.toBe(true);expect(sendMessages.mock.calls[0]?.[1]).toEqual({text:"one",workspacePath:undefined});
      const inbox=tools.find(tool=>tool.name==="golutra-read-inbox")!;
      expect(inbox.inputSchema.properties).not.toHaveProperty("cursor");
      expect((await client.callTool({name:inbox.name,arguments:{cursor:32}})).isError).toBe(true);
      expect(readInbox).not.toHaveBeenCalled();
      expect((await client.callTool({name:inbox.name,arguments:{}})).isError).not.toBe(true);
    }finally{await client.close();await server.close();}
  });
});
