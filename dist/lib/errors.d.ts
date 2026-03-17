export declare class CliExecutionError extends Error {
    readonly cliPath: string;
    readonly args: string[];
    readonly exitCode: number | null;
    readonly stdout: string;
    readonly stderr: string;
    constructor(options: {
        message: string;
        cliPath: string;
        args: string[];
        exitCode: number | null;
        stdout?: string;
        stderr?: string;
    });
}
