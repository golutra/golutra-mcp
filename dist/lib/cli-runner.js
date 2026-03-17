import { spawn } from "node:child_process";
import { CliExecutionError } from "./errors.js";
function formatCommand(request) {
    return [request.cliPath, ...request.args].join(" ");
}
function extractErrorMessage(parsed) {
    if (!parsed || typeof parsed !== "object") {
        return undefined;
    }
    if ("error" in parsed && typeof parsed.error === "string") {
        return parsed.error;
    }
    if ("result" in parsed &&
        parsed.result &&
        typeof parsed.result === "object" &&
        "message" in parsed.result &&
        typeof parsed.result.message === "string") {
        return parsed.result.message;
    }
    return undefined;
}
export class NodeCliJsonRunner {
    async executeJson(request) {
        const stdoutChunks = [];
        const stderrChunks = [];
        const child = spawn(request.cliPath, request.args, {
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"]
        });
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
        child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
        const completed = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                child.kill("SIGTERM");
                reject(new CliExecutionError({
                    message: `golutra-cli timed out after ${request.timeoutMs}ms`,
                    cliPath: request.cliPath,
                    args: request.args,
                    exitCode: null,
                    stdout: stdoutChunks.join(""),
                    stderr: stderrChunks.join("")
                }));
            }, request.timeoutMs);
            child.once("error", (error) => {
                clearTimeout(timer);
                reject(new CliExecutionError({
                    message: `failed to start golutra-cli: ${error.message}`,
                    cliPath: request.cliPath,
                    args: request.args,
                    exitCode: null,
                    stdout: stdoutChunks.join(""),
                    stderr: stderrChunks.join("")
                }));
            });
            child.once("close", (exitCode) => {
                clearTimeout(timer);
                resolve({
                    exitCode,
                    stdout: stdoutChunks.join(""),
                    stderr: stderrChunks.join("")
                });
            });
        });
        const trimmedStdout = completed.stdout.trim();
        if (!trimmedStdout) {
            throw new CliExecutionError({
                message: completed.stderr.trim() ||
                    `golutra-cli returned no JSON output: ${formatCommand(request)}`,
                cliPath: request.cliPath,
                args: request.args,
                exitCode: completed.exitCode,
                stdout: completed.stdout,
                stderr: completed.stderr
            });
        }
        let parsed;
        try {
            parsed = JSON.parse(trimmedStdout);
        }
        catch (error) {
            throw new CliExecutionError({
                message: `golutra-cli returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
                cliPath: request.cliPath,
                args: request.args,
                exitCode: completed.exitCode,
                stdout: completed.stdout,
                stderr: completed.stderr
            });
        }
        if (completed.exitCode !== 0) {
            throw new CliExecutionError({
                message: extractErrorMessage(parsed) ??
                    completed.stderr.trim() ??
                    `golutra-cli exited with code ${completed.exitCode}`,
                cliPath: request.cliPath,
                args: request.args,
                exitCode: completed.exitCode,
                stdout: completed.stdout,
                stderr: completed.stderr
            });
        }
        return parsed;
    }
}
//# sourceMappingURL=cli-runner.js.map