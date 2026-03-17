import { describe, expect, it, vi } from "vitest";

import { ContextStore } from "../src/lib/context.js";
import { registerTools } from "../src/lib/toolkit.js";

class FakeMcpServer {
  readonly tools = new Map<string, (input: Record<string, unknown>) => unknown>();

  registerTool(
    name: string,
    _definition: unknown,
    handler: (input: Record<string, unknown>) => unknown
  ): void {
    this.tools.set(name, handler);
  }
}

describe("registerTools", () => {
  it("lets golutra-list-skills inherit the stored workspace context", async () => {
    const server = new FakeMcpServer();
    const contextStore = new ContextStore({
      cliPath: "golutra-cli",
      workspacePath: "/workspace",
      timeoutMs: 30_000
    });
    const listSkills = vi.fn().mockResolvedValue({
      skills: {},
      projectSkills: [
        {
          name: "alpha",
          targetPath: "/skills/alpha",
          skillMdPath: "/skills/alpha/SKILL.md",
          relativePath: ".golutra/skills/alpha/SKILL.md"
        }
      ]
    });

    registerTools(
      server as never,
      contextStore,
      {
        listSkills
      } as never
    );

    const handler = server.tools.get("golutra-list-skills");
    expect(handler).toBeTypeOf("function");

    const result = await handler?.({});

    expect(listSkills).toHaveBeenCalledWith(
      {
        cliPath: "golutra-cli",
        workspacePath: "/workspace",
        timeoutMs: 30_000
      },
      {
        workspacePath: "/workspace"
      }
    );
    expect(result).toMatchObject({
      structuredContent: {
        projectSkills: [
          {
            name: "alpha"
          }
        ]
      }
    });
  });
});
