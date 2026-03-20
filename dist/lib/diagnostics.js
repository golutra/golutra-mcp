import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { CliExecutionError } from "./errors.js";
import { buildToolError } from "./tool-results.js";
function normalizeMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
function normalizeLowerText(error) {
    if (error instanceof CliExecutionError) {
        return [error.message, error.stdout, error.stderr].join("\n").toLowerCase();
    }
    return normalizeMessage(error).toLowerCase();
}
function toStructuredError(error) {
    return buildToolError(error).structuredContent;
}
function isAbsolutePathForAnyPlatform(candidatePath) {
    return path.isAbsolute(candidatePath) || path.win32.isAbsolute(candidatePath);
}
function inferCliPathSource(cliPath) {
    return isAbsolutePathForAnyPlatform(cliPath) ? "explicit-path" : "command-from-path";
}
export function inspectCliPath(cliPath) {
    const source = inferCliPathSource(cliPath);
    if (source === "command-from-path") {
        return {
            ok: true,
            cliPath,
            source
        };
    }
    const exists = existsSync(cliPath);
    if (!exists) {
        return {
            ok: false,
            cliPath,
            source,
            exists,
            reasonCode: "CLI_PATH_NOT_FOUND",
            message: `Configured golutra-cli path does not exist: ${cliPath}`
        };
    }
    return {
        ok: true,
        cliPath,
        source,
        exists
    };
}
export function inspectWorkspacePath(workspacePath) {
    if (!workspacePath) {
        return {
            ok: false,
            skipped: true,
            reasonCode: "WORKSPACE_PATH_MISSING",
            message: "workspacePath is required for app-backed diagnostics. Pass it directly or store it with golutra-set-context."
        };
    }
    try {
        if (!existsSync(workspacePath)) {
            return {
                ok: false,
                workspacePath,
                reasonCode: "WORKSPACE_PATH_NOT_FOUND",
                message: `workspacePath does not exist: ${workspacePath}`
            };
        }
        if (!statSync(workspacePath).isDirectory()) {
            return {
                ok: false,
                workspacePath,
                reasonCode: "WORKSPACE_PATH_NOT_DIRECTORY",
                message: `workspacePath is not a directory: ${workspacePath}`
            };
        }
    }
    catch (error) {
        return {
            ok: false,
            workspacePath,
            reasonCode: "WORKSPACE_PATH_INVALID",
            message: normalizeMessage(error),
            error: toStructuredError(error)
        };
    }
    return {
        ok: true,
        workspacePath
    };
}
export function inspectUserId(userId) {
    if (!userId) {
        return {
            ok: false,
            skipped: true,
            reasonCode: "USER_ID_MISSING",
            message: "userId is required for the app-backed chat.conversations.list diagnostic probe."
        };
    }
    return {
        ok: true,
        userId
    };
}
export function classifyCliProbeFailure(error) {
    const lowerText = normalizeLowerText(error);
    if (lowerText.includes("enoent") ||
        lowerText.includes("cannot find the file") ||
        lowerText.includes("not recognized as an internal or external command") ||
        lowerText.includes("failed to start golutra-cli")) {
        return {
            ok: false,
            reasonCode: "CLI_NOT_FOUND",
            message: "golutra-cli could not be started from the resolved path or PATH.",
            error: toStructuredError(error),
            nextSteps: [
                "Set GOLUTRA_CLI_PATH to the installed golutra-cli binary, or ensure golutra-cli is available on PATH.",
                "Verify the Golutra desktop app installation is complete for this platform."
            ]
        };
    }
    if (lowerText.includes("timed out")) {
        return {
            ok: false,
            reasonCode: "CLI_TIMEOUT",
            message: "golutra-cli did not respond before the configured timeout expired.",
            error: toStructuredError(error),
            nextSteps: [
                "Increase GOLUTRA_COMMAND_TIMEOUT_MS if the local environment is slow.",
                "Run golutra-cli manually once to confirm it starts normally."
            ]
        };
    }
    if (lowerText.includes("returned invalid json") ||
        lowerText.includes("returned no json") ||
        lowerText.includes("failed to decode response")) {
        return {
            ok: false,
            reasonCode: "CLI_PROTOCOL_ERROR",
            message: "golutra-cli responded, but the output was not a valid structured JSON result.",
            error: toStructuredError(error),
            nextSteps: [
                "Run golutra-cli skills manually and confirm it returns valid JSON in this environment.",
                "Check whether the installed golutra-cli version matches the expected Golutra desktop build."
            ]
        };
    }
    return {
        ok: false,
        reasonCode: "CLI_COMMAND_FAILED",
        message: "golutra-cli was reachable, but the CLI-level diagnostic probe still failed.",
        error: toStructuredError(error),
        nextSteps: [
            "Run golutra-cli skills manually to inspect the raw CLI error.",
            "Verify the selected profile and Golutra installation are valid for this machine."
        ]
    };
}
export function classifyAppProbeFailure(error, runtimeContext) {
    const lowerText = normalizeLowerText(error);
    const profile = runtimeContext.profile ?? "stable";
    // 这里的判断优先看 IPC 连接失败特征，避免把“桌面端没启动”误报成普通业务错误。
    if (lowerText.includes("failed to connect golutra ipc") ||
        lowerText.includes("golutra-command.sock") ||
        lowerText.includes("\\\\.\\pipe\\golutra-command") ||
        lowerText.includes("no such file or directory") ||
        lowerText.includes("cannot find the file specified")) {
        return {
            ok: false,
            reasonCode: "APP_NOT_RUNNING_OR_PROFILE_MISMATCH",
            message: `Golutra desktop app for profile ${profile} is not reachable through local IPC.`,
            error: toStructuredError(error),
            nextSteps: [
                `Start the Golutra desktop app with profile ${profile}, then retry the diagnostic.`,
                "If another profile is currently running, update GOLUTRA_PROFILE or golutra-set-context to the correct profile."
            ]
        };
    }
    return {
        ok: false,
        reasonCode: "APP_COMMAND_FAILED",
        message: "golutra-cli reached the desktop app probe stage, but the app-backed command still failed.",
        error: toStructuredError(error),
        nextSteps: [
            "Verify that workspacePath matches the workspace currently opened in the Golutra desktop app.",
            "Verify that userId belongs to that workspace and has permission to list conversations."
        ]
    };
}
export function buildSkippedAppProbe(reasonCode, message) {
    return {
        ok: false,
        skipped: true,
        reasonCode,
        message
    };
}
export function summarizeDiagnosis(checks) {
    const values = Object.values(checks);
    const reasonCodes = values
        .map((check) => check.reasonCode)
        .filter((reasonCode) => Boolean(reasonCode));
    const hasError = values.some((check) => !check.ok && !check.skipped);
    const hasSkipped = values.some((check) => !check.ok && Boolean(check.skipped));
    if (hasError) {
        return {
            ok: false,
            status: "error",
            reasonCodes
        };
    }
    if (hasSkipped) {
        return {
            ok: false,
            status: "partial",
            reasonCodes
        };
    }
    return {
        ok: true,
        status: "ok",
        reasonCodes
    };
}
export function mergeNextSteps(stepLists) {
    const seen = new Set();
    const result = [];
    for (const stepList of stepLists) {
        for (const step of stepList) {
            if (seen.has(step)) {
                continue;
            }
            seen.add(step);
            result.push(step);
        }
    }
    return result;
}
//# sourceMappingURL=diagnostics.js.map