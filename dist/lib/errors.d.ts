export declare class CliExecutionError extends Error {
    readonly cliPath: string;
    readonly args: string[];
    readonly exitCode: number | null;
    readonly stdout: string;
    readonly stderr: string;
    readonly code: string | undefined;
    readonly requestId: string | undefined;
    constructor(options: {
        message: string;
        cliPath: string;
        args: string[];
        exitCode: number | null;
        stdout?: string;
        stderr?: string;
        code?: string | undefined;
        requestId?: string | undefined;
    });
}
