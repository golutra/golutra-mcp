import type { RuntimeContextSnapshot } from "./types.js";
export type DiagnosisReasonCode = "CLI_PATH_NOT_FOUND" | "CLI_NOT_FOUND" | "CLI_TIMEOUT" | "CLI_PROTOCOL_ERROR" | "CLI_COMMAND_FAILED" | "WORKSPACE_PATH_MISSING" | "WORKSPACE_PATH_NOT_FOUND" | "WORKSPACE_PATH_NOT_DIRECTORY" | "WORKSPACE_PATH_INVALID" | "USER_ID_MISSING" | "APP_NOT_RUNNING_OR_PROFILE_MISMATCH" | "APP_COMMAND_FAILED" | "APP_PROBE_SKIPPED";
export interface DiagnosisCheck {
    ok: boolean;
    skipped?: boolean;
    reasonCode?: DiagnosisReasonCode;
    message?: string;
    error?: Record<string, unknown>;
    [key: string]: unknown;
}
export declare function inspectCliPath(cliPath: string): DiagnosisCheck & {
    cliPath: string;
    source: "explicit-path" | "command-from-path";
    exists?: boolean;
};
export declare function inspectWorkspacePath(workspacePath: string | undefined): DiagnosisCheck & {
    workspacePath?: string;
};
export declare function inspectUserId(userId: string | undefined): DiagnosisCheck & {
    userId?: string;
};
export declare function classifyCliProbeFailure(error: unknown): DiagnosisCheck & {
    nextSteps: string[];
};
export declare function classifyAppProbeFailure(error: unknown, runtimeContext: RuntimeContextSnapshot): DiagnosisCheck & {
    nextSteps: string[];
};
export declare function buildSkippedAppProbe(reasonCode: DiagnosisReasonCode, message: string): DiagnosisCheck;
export declare function summarizeDiagnosis(checks: Record<string, DiagnosisCheck>): {
    ok: boolean;
    status: "ok" | "partial" | "error";
    reasonCodes: DiagnosisReasonCode[];
};
export declare function mergeNextSteps(stepLists: string[][]): string[];
