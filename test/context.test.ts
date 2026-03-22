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

  it("auto-discovers the default Windows CLI install path when present", () => {
    const cliPath = resolveDefaultCliPath(
      {
        LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local"
      },
      {
        platform: "win32",
        homeDirectory: "C:\\Users\\tester",
        pathExists: (candidatePath) =>
          candidatePath ===
          "C:\\Users\\tester\\AppData\\Local\\Programs\\Golutra\\golutra-cli.exe"
      }
    );

    expect(cliPath).toBe(
      "C:\\Users\\tester\\AppData\\Local\\Programs\\Golutra\\golutra-cli.exe"
    );
  });

  it("auto-discovers the default Linux CLI install path when present", () => {
    const cliPath = resolveDefaultCliPath(
      {},
      {
        platform: "linux",
        homeDirectory: "/home/tester",
        pathExists: (candidatePath) =>
          candidatePath === "/home/tester/.local/bin/golutra-cli"
      }
    );

    expect(cliPath).toBe("/home/tester/.local/bin/golutra-cli");
  });

  it("falls back to golutra-cli on Unix-like platforms when no auto-discovered candidate exists", () => {
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

  it("falls back to golutra-cli.exe on Windows when no auto-discovered candidate exists", () => {
    const cliPath = resolveDefaultCliPath(
      {},
      {
        platform: "win32",
        homeDirectory: "C:\\Users\\tester",
        pathExists: () => false
      }
    );

    expect(cliPath).toBe("golutra-cli.exe");
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

  it("does not persist a one-time workspacePath override", () => {
    const store = new ContextStore({
      cliPath: "golutra-cli",
      profile: "stable",
      workspacePath: "/base",
      timeoutMs: 30_000
    });

    const resolved = store.resolveCommandContext({
      workspacePath: "/override"
    });

    expect(resolved.workspacePath).toBe("/override");
    expect(store.getSnapshot()).toEqual({
      cliPath: "golutra-cli",
      profile: "stable",
      workspacePath: "/base",
      timeoutMs: 30_000
    });
  });

  it("persists workspacePath when defaults are explicitly updated", () => {
    const store = new ContextStore({
      cliPath: "golutra-cli",
      profile: "stable",
      workspacePath: "/base",
      timeoutMs: 30_000
    });

    const snapshot = store.update({
      workspacePath: "/changed"
    });

    expect(snapshot).toEqual({
      cliPath: "golutra-cli",
      profile: "stable",
      workspacePath: "/changed",
      timeoutMs: 30_000
    });
    expect(store.requireWorkspacePath()).toBe("/changed");
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
