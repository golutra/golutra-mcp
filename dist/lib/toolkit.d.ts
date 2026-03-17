import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ContextStore } from "./context.js";
import type { GolutraCliGateway } from "./golutra-client.js";
export declare function registerTools(server: McpServer, contextStore: ContextStore, gateway: GolutraCliGateway): void;
