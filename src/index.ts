#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { NodeCliJsonRunner } from "./lib/cli-runner.js";
import { ContextStore, createInitialContext } from "./lib/context.js";
import { GolutraCliGateway } from "./lib/golutra-client.js";
import { readPackageMetadata } from "./lib/package-metadata.js";
import { registerTools } from "./lib/toolkit.js";

const { name: SERVER_NAME, version: SERVER_VERSION } = readPackageMetadata();

async function main(): Promise<void> {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  });

  const contextStore = new ContextStore(createInitialContext(process.env));
  const gateway = new GolutraCliGateway(new NodeCliJsonRunner());

  // 设计原因：MCP 侧只暴露稳定工具面，不直接泄漏 golutra-cli/IPC 的内部细节。
  registerTools(server, contextStore, gateway);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${SERVER_NAME} failed to start\n${message}\n`);
  process.exit(1);
});
