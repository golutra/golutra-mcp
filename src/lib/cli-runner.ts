import { spawn } from "node:child_process";

import { CliExecutionError } from "./errors.js";
import type { CliCommandRequest } from "./types.js";

export interface CliJsonRunner {
  executeJson<T>(request: CliCommandRequest): Promise<T>;
  executeText?(request: CliCommandRequest): Promise<string>;
}

function formatCommand(request: CliCommandRequest): string {
  return [request.cliPath, ...request.args].join(" ");
}

function extractErrorMessage(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }
  if ("error" in parsed && typeof parsed.error === "string") {
    return parsed.error;
  }
  if (
    "result" in parsed &&
    parsed.result &&
    typeof parsed.result === "object" &&
    "message" in parsed.result &&
    typeof parsed.result.message === "string"
  ) {
    return parsed.result.message;
  }
  return undefined;
}

export class NodeCliJsonRunner implements CliJsonRunner {
  private async executeRaw(request: CliCommandRequest): Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }> {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    const child = spawn(request.cliPath, request.args, {
      env: {
        ...process.env,
        ...request.env
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: string) => stderrChunks.push(chunk));

    return new Promise<{
      exitCode: number | null;
      stdout: string;
      stderr: string;
    }>((resolve, reject) => {
      let timedOut = false;
      let startError: Error | undefined;
      let inputError: Error | undefined;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        // 必须等待关闭并回收进程；停止 CLI 不代表 Host 中的任务已取消。
        killTimer = setTimeout(() => child.kill("SIGKILL"), 500);
      }, request.timeoutMs);

      child.once("error", (error) => {
        startError = error;
      });

      child.stdin.on("error", (error: Error) => { inputError = error; });
      child.stdin.end(request.stdin ?? "", "utf8");

      child.once("close", (exitCode) => {
        clearTimeout(timer);
        if (killTimer) { clearTimeout(killTimer); }
        if (timedOut || startError || (inputError && exitCode === 0 && request.stdin)) {
          reject(new CliExecutionError({
            message: timedOut
              ? `golutra-cli timed out after ${request.timeoutMs}ms; Host execution may continue; do not automatically resend`
              : startError ? `failed to start golutra-cli: ${startError.message}`
                : `failed to write command stdin: ${inputError?.message}`,
            code: timedOut ? "CLI_PROCESS_TIMEOUT" : startError ? "CLI_START_FAILED" : "CLI_STDIN_FAILED",
            cliPath: request.cliPath, args: request.args, exitCode,
            stdout: stdoutChunks.join(""), stderr: stderrChunks.join("")
          }));
          return;
        }
        resolve({
          exitCode,
          stdout: stdoutChunks.join(""),
          stderr: stderrChunks.join("")
        });
      });
    });
  }

  async executeText(request: CliCommandRequest): Promise<string> {
    const completed = await this.executeRaw(request);

    if (completed.exitCode !== 0) {
      throw new CliExecutionError({
        message:
          completed.stderr.trim() ||
          completed.stdout.trim() ||
          `golutra-cli exited with code ${completed.exitCode}`,
        cliPath: request.cliPath,
        args: request.args,
        exitCode: completed.exitCode,
        stdout: completed.stdout,
        stderr: completed.stderr
      });
    }

    return completed.stdout.trimEnd();
  }

  async executeJson<T>(request: CliCommandRequest): Promise<T> {
    const completed = await this.executeRaw(request);

    const trimmedStdout = completed.stdout.trim();
    if (!trimmedStdout) {
      throw new CliExecutionError({
        message:
          completed.stderr.trim() ||
          `golutra-cli returned no JSON output: ${formatCommand(request)}`,
        cliPath: request.cliPath,
        args: request.args,
        exitCode: completed.exitCode,
        stdout: completed.stdout,
        stderr: completed.stderr
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmedStdout);
    } catch (error) {
      throw new CliExecutionError({
        message: `golutra-cli returned invalid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
        cliPath: request.cliPath,
        args: request.args,
        exitCode: completed.exitCode,
        stdout: completed.stdout,
        stderr: completed.stderr
      });
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CliExecutionError({
        message: "golutra-cli returned invalid JSON: expected an object",
        code: "CLI_PROTOCOL_ERROR", cliPath: request.cliPath, args: request.args,
        exitCode: completed.exitCode, stdout: completed.stdout, stderr: completed.stderr
      });
    }

    if (completed.exitCode !== 0 || ("ok" in parsed && parsed.ok === false)) {
      throw new CliExecutionError({
        message:
          extractErrorMessage(parsed) ||
          completed.stderr.trim() ||
          `golutra-cli exited with code ${completed.exitCode}`,
        code: "errorCode" in parsed && typeof parsed.errorCode === "string" ? parsed.errorCode : undefined,
        requestId: "requestId" in parsed && typeof parsed.requestId === "string" ? parsed.requestId : undefined,
        cliPath: request.cliPath,
        args: request.args,
        exitCode: completed.exitCode,
        stdout: completed.stdout,
        stderr: completed.stderr
      });
    }

    return parsed as T;
  }
}
