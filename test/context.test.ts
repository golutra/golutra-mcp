import { describe, expect, it } from "vitest";

import {
  ContextStore,
  createInitialContext,
  resolveDefaultCliPath
} from "../src/lib/context.js";

describe("ContextStore", () => {
  it("reads default values from environment", () => {
    const initial = createInitialContext({
      GOLUTRA_CLI_PATH: "/tmp/golutra-cli",
      GOLUTRA_PROFILE: "dev",
      GOLUTRA_WORKSPACE_PATH: "/tmp/workspace",
      GOLUTRA_COMMAND_TIMEOUT_MS: "12345"
    });

    expect(initial).toEqual({
      cliPath: "/tmp/golutra-cli",
      profile: "dev",
      workspacePath: "/tmp/workspace",
      timeoutMs: 12345
    });
  });

  it("prefers an explicit GOLUTRA_CLI_PATH over auto-discovery", () => {
    const cliPath = resolveDefaultCliPath(
      {
        GOLUTRA_CLI_PATH: "/custom/golutra-cli"
      },
      {
        platform: "darwin",
        pathExists: () => true
      }
    );

    expect(cliPath).toBe("/custom/golutra-cli");
  });

  it("auto-discovers the default macOS app-bundled CLI when present", () => {
    const cliPath = resolveDefaultCliPath(
      {},
      {
        platform: "darwin",
        homeDirectory: "/Users/tester",
        pathExists: (candidatePath) =>
          candidatePath === "/Applications/Golutra.app/Contents/MacOS/golutra-cli"
      }
    );

    expect(cliPath).toBe("/Applications/Golutra.app/Contents/MacOS/golutra-cli");
  });

  it("falls back to golutra-cli when no auto-discovered candidate exists", () => {
    const cliPath = resolveDefaultCliPath(
      {},
      {
        platform: "darwin",
        homeDirectory: "/Users/tester",
        pathExists: () => false
      }
    );

    expect(cliPath).toBe("golutra-cli");
  });

  it("requires workspacePath when neither input nor stored context provides one", () => {
    const store = new ContextStore({
      cliPath: "golutra-cli",
      timeoutMs: 30_000
    });

    expect(() => store.requireWorkspacePath()).toThrow(/workspacePath is required/i);
  });

  it("allows overriding stored context for one command resolution", () => {
    const store = new ContextStore({
      cliPath: "golutra-cli",
      profile: "stable",
      workspacePath: "/base",
      timeoutMs: 30_000
    });

    const resolved = store.resolveCommandContext({
      profile: "canary",
      workspacePath: "/override"
    });

    expect(resolved).toEqual({
      cliPath: "golutra-cli",
      profile: "canary",
      workspacePath: "/override",
      timeoutMs: 30_000
    });
  });

  it("resets to the initial startup context", () => {
    const store = new ContextStore({
      cliPath: "golutra-cli",
      profile: "dev",
      workspacePath: "/initial",
      timeoutMs: 10_000
    });

    store.update({
      cliPath: "/custom/golutra-cli",
      profile: "stable",
      workspacePath: "/changed",
      timeoutMs: 20_000
    });

    expect(store.reset()).toEqual({
      cliPath: "golutra-cli",
      profile: "dev",
      workspacePath: "/initial",
      timeoutMs: 10_000
    });
  });
});
