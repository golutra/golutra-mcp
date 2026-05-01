import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { GOLUTRA_HOST_KINDS, GOLUTRA_PROFILES } from "./types.js";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
export const DEFAULT_TARGET_ORDER = [
    { profile: "stable", hostKind: "desktop" },
    { profile: "stable", hostKind: "server" },
    { profile: "dev", hostKind: "desktop" },
    { profile: "dev", hostKind: "server" }
];
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
function normalizeHostKind(value) {
    const trimmed = normalizeNonEmptyString(value)?.toLowerCase();
    if (!trimmed || trimmed === "auto") {
        return undefined;
    }
    const normalized = trimmed === "web" ? "server" : trimmed;
    if (GOLUTRA_HOST_KINDS.includes(normalized)) {
        return normalized;
    }
    throw new Error(`Unsupported Golutra hostKind: ${trimmed}`);
}
function normalizeTargetOrder(value) {
    if (Array.isArray(value)) {
        const targets = value.map((target) => ({
            profile: normalizeProfile(target.profile) ?? "stable",
            hostKind: normalizeHostKind(target.hostKind) ?? "desktop"
        }));
        return targets.length > 0 ? dedupeTargets(targets) : undefined;
    }
    const trimmed = normalizeNonEmptyString(value);
    if (!trimmed) {
        return undefined;
    }
    const targets = trimmed.split(",").map((rawTarget) => {
        const [rawProfile, rawHostKind] = rawTarget.split(":");
        const profile = normalizeProfile(rawProfile);
        const hostKind = normalizeHostKind(rawHostKind);
        if (!profile || !hostKind) {
            throw new Error("Unsupported Golutra targetOrder entry. Expected profile:hostKind, for example stable:desktop.");
        }
        return { profile, hostKind };
    });
    return targets.length > 0 ? dedupeTargets(targets) : undefined;
}
function dedupeTargets(targets) {
    const seen = new Set();
    const result = [];
    for (const target of targets) {
        const key = `${target.profile}:${target.hostKind}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(target);
    }
    return result;
}
export function resolveRuntimeTargets(context) {
    if (context.targetOrder && context.targetOrder.length > 0) {
        return context.targetOrder;
    }
    const profiles = context.profile
        ? [context.profile]
        : DEFAULT_TARGET_ORDER.map((target) => target.profile);
    const hostKinds = context.hostKind
        ? [context.hostKind]
        : DEFAULT_TARGET_ORDER.map((target) => target.hostKind);
    const candidates = [];
    for (const defaultTarget of DEFAULT_TARGET_ORDER) {
        if (profiles.includes(defaultTarget.profile) &&
            hostKinds.includes(defaultTarget.hostKind)) {
            candidates.push(defaultTarget);
        }
    }
    return dedupeTargets(candidates);
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
    const context = {
        cliPath: resolveDefaultCliPath(env),
        timeoutMs: normalizeTimeout(env.GOLUTRA_COMMAND_TIMEOUT_MS)
    };
    const profile = normalizeProfile(env.GOLUTRA_PROFILE);
    const hostKind = normalizeHostKind(env.GOLUTRA_CLI_HOST_KIND ?? env.GOLUTRA_HOST_KIND);
    const targetOrder = normalizeTargetOrder(env.GOLUTRA_TARGET_ORDER);
    const workspacePath = normalizeNonEmptyString(env.GOLUTRA_WORKSPACE_PATH);
    if (profile) {
        context.profile = profile;
    }
    if (hostKind) {
        context.hostKind = hostKind;
    }
    if (targetOrder) {
        context.targetOrder = targetOrder;
    }
    if (workspacePath) {
        context.workspacePath = workspacePath;
    }
    return context;
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
    mergeContext(baseContext, nextValues) {
        const nextContext = {
            cliPath: normalizeNonEmptyString(nextValues.cliPath) ?? baseContext.cliPath,
            timeoutMs: typeof nextValues.timeoutMs === "number"
                ? normalizeTimeout(nextValues.timeoutMs)
                : baseContext.timeoutMs
        };
        const profile = nextValues.profile ?? baseContext.profile;
        const hostKind = nextValues.hostKind ?? baseContext.hostKind;
        const targetOrder = nextValues.targetOrder !== undefined
            ? normalizeTargetOrder(nextValues.targetOrder)
            : nextValues.profile !== undefined || nextValues.hostKind !== undefined
                ? undefined
                : baseContext.targetOrder;
        const workspacePath = normalizeNonEmptyString(nextValues.workspacePath) ??
            baseContext.workspacePath;
        if (profile) {
            nextContext.profile = profile;
        }
        if (hostKind) {
            nextContext.hostKind = hostKind;
        }
        if (targetOrder) {
            nextContext.targetOrder = targetOrder;
        }
        if (workspacePath) {
            nextContext.workspacePath = workspacePath;
        }
        return nextContext;
    }
    update(nextValues) {
        // `golutra-set-context` 走这里，表示显式持久化更新默认上下文。
        const nextContext = this.mergeContext(this.context, nextValues);
        this.context = nextContext;
        return this.getSnapshot();
    }
    resolveCommandContext(nextValues = {}) {
        // 普通业务 tool 走这里时，`workspacePath` 只是本次调用覆盖，不会写回默认缓存。
        return this.mergeContext(this.context, nextValues);
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