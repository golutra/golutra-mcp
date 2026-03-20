import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { GOLUTRA_PROFILES } from "./types.js";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
function normalizeNonEmptyString(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}
function uniqueNonEmptyPaths(candidatePaths) {
    const seen = new Set();
    const result = [];
    for (const candidatePath of candidatePaths) {
        const normalizedPath = candidatePath.trim();
        if (!normalizedPath || seen.has(normalizedPath)) {
            continue;
        }
        seen.add(normalizedPath);
        result.push(normalizedPath);
    }
    return result;
}
function normalizeTimeout(value) {
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
function normalizeProfile(value) {
    const trimmed = normalizeNonEmptyString(value);
    if (!trimmed) {
        return undefined;
    }
    if (GOLUTRA_PROFILES.includes(trimmed)) {
        return trimmed;
    }
    throw new Error(`Unsupported Golutra profile: ${trimmed}`);
}
function getDefaultCliCommand(platform) {
    return platform === "win32" ? "golutra-cli.exe" : "golutra-cli";
}
function getPathModule(platform) {
    return platform === "win32" ? path.win32 : path.posix;
}
function getDefaultCliCandidates(env, platform, homeDirectory) {
    const pathModule = getPathModule(platform);
    if (platform === "darwin") {
        return uniqueNonEmptyPaths([
            "/Applications/Golutra.app/Contents/MacOS/golutra-cli",
            pathModule.join(homeDirectory, "Applications", "Golutra.app", "Contents", "MacOS", "golutra-cli"),
            getDefaultCliCommand(platform)
        ]);
    }
    if (platform === "win32") {
        const localAppData = normalizeNonEmptyString(env.LOCALAPPDATA) ??
            pathModule.join(homeDirectory, "AppData", "Local");
        const programFiles = normalizeNonEmptyString(env.ProgramFiles);
        const programFilesX86 = normalizeNonEmptyString(env["ProgramFiles(x86)"]);
        const cliName = getDefaultCliCommand(platform);
        return uniqueNonEmptyPaths([
            pathModule.join(localAppData, "Programs", "Golutra", cliName),
            ...(programFiles ? [pathModule.join(programFiles, "Golutra", cliName)] : []),
            ...(programFilesX86
                ? [pathModule.join(programFilesX86, "Golutra", cliName)]
                : []),
            cliName
        ]);
    }
    if (platform === "linux") {
        const cliName = getDefaultCliCommand(platform);
        return uniqueNonEmptyPaths([
            pathModule.join(homeDirectory, ".local", "bin", cliName),
            pathModule.join(homeDirectory, ".cargo", "bin", cliName),
            "/usr/local/bin/golutra-cli",
            "/usr/bin/golutra-cli",
            "/opt/Golutra/golutra-cli",
            "/app/bin/golutra-cli",
            cliName
        ]);
    }
    return [getDefaultCliCommand(platform)];
}
export function resolveDefaultCliPath(env, options = {}) {
    const explicitCliPath = normalizeNonEmptyString(env.GOLUTRA_CLI_PATH);
    if (explicitCliPath) {
        return explicitCliPath;
    }
    const platform = options.platform ?? process.platform;
    const homeDirectory = options.homeDirectory ?? homedir();
    const pathExists = options.pathExists ?? existsSync;
    const candidates = getDefaultCliCandidates(env, platform, homeDirectory);
    const fallbackCommand = getDefaultCliCommand(platform);
    const pathModule = getPathModule(platform);
    return (candidates.find((candidatePath) => pathModule.isAbsolute(candidatePath) && pathExists(candidatePath)) ?? fallbackCommand);
}
export function createInitialContext(env) {
    return {
        cliPath: resolveDefaultCliPath(env),
        profile: normalizeProfile(env.GOLUTRA_PROFILE),
        workspacePath: normalizeNonEmptyString(env.GOLUTRA_WORKSPACE_PATH),
        timeoutMs: normalizeTimeout(env.GOLUTRA_COMMAND_TIMEOUT_MS)
    };
}
export class ContextStore {
    initialContext;
    context;
    constructor(initialContext) {
        this.initialContext = { ...initialContext };
        this.context = { ...initialContext };
    }
    getSnapshot() {
        return { ...this.context };
    }
    reset() {
        this.context = { ...this.initialContext };
        return this.getSnapshot();
    }
    update(nextValues) {
        const nextContext = {
            cliPath: normalizeNonEmptyString(nextValues.cliPath) ?? this.context.cliPath,
            profile: nextValues.profile ?? this.context.profile,
            workspacePath: normalizeNonEmptyString(nextValues.workspacePath) ??
                this.context.workspacePath,
            timeoutMs: typeof nextValues.timeoutMs === "number"
                ? normalizeTimeout(nextValues.timeoutMs)
                : this.context.timeoutMs
        };
        this.context = nextContext;
        return this.getSnapshot();
    }
    resolveCommandContext(nextValues = {}) {
        return {
            cliPath: normalizeNonEmptyString(nextValues.cliPath) ?? this.context.cliPath,
            profile: nextValues.profile ?? this.context.profile,
            workspacePath: normalizeNonEmptyString(nextValues.workspacePath) ??
                this.context.workspacePath,
            timeoutMs: typeof nextValues.timeoutMs === "number"
                ? normalizeTimeout(nextValues.timeoutMs)
                : this.context.timeoutMs
        };
    }
    requireWorkspacePath(nextValues = {}) {
        const workspacePath = this.resolveCommandContext(nextValues).workspacePath;
        if (!workspacePath) {
            throw new Error("workspacePath is required. Pass it to the tool call or set a default with golutra-set-context.");
        }
        return workspacePath;
    }
}
//# sourceMappingURL=context.js.map