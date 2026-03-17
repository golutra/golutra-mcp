import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { GOLUTRA_PROFILES } from "./types.js";
import type {
  CommandContextInput,
  GolutraProfile,
  RuntimeContextSnapshot
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
const DEFAULT_CLI_COMMAND = "golutra-cli";

function normalizeNonEmptyString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeTimeout(value: number | string | undefined): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return Math.min(value, MAX_TIMEOUT_MS);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return Math.min(parsed, MAX_TIMEOUT_MS);
    }
  }
  return DEFAULT_TIMEOUT_MS;
}

function normalizeProfile(value: string | undefined): GolutraProfile | undefined {
  const trimmed = normalizeNonEmptyString(value);
  if (!trimmed) {
    return undefined;
  }
  if (GOLUTRA_PROFILES.includes(trimmed as GolutraProfile)) {
    return trimmed as GolutraProfile;
  }
  throw new Error(`Unsupported Golutra profile: ${trimmed}`);
}

function getDefaultCliCandidates(
  platform: NodeJS.Platform,
  homeDirectory: string
): string[] {
  if (platform === "darwin") {
    return [
      "/Applications/Golutra.app/Contents/MacOS/golutra-cli",
      path.join(
        homeDirectory,
        "Applications",
        "Golutra.app",
        "Contents",
        "MacOS",
        "golutra-cli"
      ),
      DEFAULT_CLI_COMMAND
    ];
  }

  return [DEFAULT_CLI_COMMAND];
}

export function resolveDefaultCliPath(
  env: NodeJS.ProcessEnv,
  options: {
    platform?: NodeJS.Platform;
    homeDirectory?: string;
    pathExists?: (candidatePath: string) => boolean;
  } = {}
): string {
  const explicitCliPath = normalizeNonEmptyString(env.GOLUTRA_CLI_PATH);
  if (explicitCliPath) {
    return explicitCliPath;
  }

  const platform = options.platform ?? process.platform;
  const homeDirectory = options.homeDirectory ?? homedir();
  const pathExists = options.pathExists ?? existsSync;
  const candidates = getDefaultCliCandidates(platform, homeDirectory);

  return (
    candidates.find(
      (candidatePath) => path.isAbsolute(candidatePath) && pathExists(candidatePath)
    ) ?? DEFAULT_CLI_COMMAND
  );
}

export function createInitialContext(
  env: NodeJS.ProcessEnv
): RuntimeContextSnapshot {
  return {
    cliPath: resolveDefaultCliPath(env),
    profile: normalizeProfile(env.GOLUTRA_PROFILE),
    workspacePath: normalizeNonEmptyString(env.GOLUTRA_WORKSPACE_PATH),
    timeoutMs: normalizeTimeout(env.GOLUTRA_COMMAND_TIMEOUT_MS)
  };
}

export class ContextStore {
  private readonly initialContext: RuntimeContextSnapshot;
  private context: RuntimeContextSnapshot;

  constructor(initialContext: RuntimeContextSnapshot) {
    this.initialContext = { ...initialContext };
    this.context = { ...initialContext };
  }

  getSnapshot(): RuntimeContextSnapshot {
    return { ...this.context };
  }

  reset(): RuntimeContextSnapshot {
    this.context = { ...this.initialContext };
    return this.getSnapshot();
  }

  update(nextValues: CommandContextInput): RuntimeContextSnapshot {
    const nextContext: RuntimeContextSnapshot = {
      cliPath:
        normalizeNonEmptyString(nextValues.cliPath) ?? this.context.cliPath,
      profile: nextValues.profile ?? this.context.profile,
      workspacePath:
        normalizeNonEmptyString(nextValues.workspacePath) ??
        this.context.workspacePath,
      timeoutMs:
        typeof nextValues.timeoutMs === "number"
          ? normalizeTimeout(nextValues.timeoutMs)
          : this.context.timeoutMs
    };
    this.context = nextContext;
    return this.getSnapshot();
  }

  resolveCommandContext(nextValues: CommandContextInput = {}): RuntimeContextSnapshot {
    return {
      cliPath:
        normalizeNonEmptyString(nextValues.cliPath) ?? this.context.cliPath,
      profile: nextValues.profile ?? this.context.profile,
      workspacePath:
        normalizeNonEmptyString(nextValues.workspacePath) ??
        this.context.workspacePath,
      timeoutMs:
        typeof nextValues.timeoutMs === "number"
          ? normalizeTimeout(nextValues.timeoutMs)
          : this.context.timeoutMs
    };
  }

  requireWorkspacePath(nextValues: CommandContextInput = {}): string {
    const workspacePath = this.resolveCommandContext(nextValues).workspacePath;
    if (!workspacePath) {
      throw new Error(
        "workspacePath is required. Pass it to the tool call or set a default with golutra-set-context."
      );
    }
    return workspacePath;
  }
}
