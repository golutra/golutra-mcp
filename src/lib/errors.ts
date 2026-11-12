export class CliExecutionError extends Error {
  readonly cliPath: string;
  readonly args: string[];
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly response: Record<string, unknown> | undefined;
  readonly retryFile: string | undefined;

  constructor(options: {
    message: string;
    cliPath: string;
    args: string[];
    exitCode: number | null;
    stdout?: string;
    stderr?: string;
    code?: string | undefined;
    requestId?: string | undefined;
  }) {
    super(options.message);
    this.name = "CliExecutionError";
    this.cliPath = options.cliPath;
    this.args = options.args;
    this.exitCode = options.exitCode;
    this.stdout = options.stdout ?? "";
    this.stderr = options.stderr ?? "";
    this.code = options.code;
    this.requestId = options.requestId;
    this.response = readJsonObject(this.stdout);
    // CLI 在发送前输出持久化凭据；进程被超时终止时也不能丢失原请求的重试入口。
    this.retryFile = typeof this.response?.retryFile === "string"
      ? this.response.retryFile
      : readRetryDiagnostic(this.stderr);
  }
}

function readJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

function readRetryDiagnostic(stderr: string): string | undefined {
  for (const line of stderr.split("\n").reverse()) {
    const value = readJsonObject(line);
    if (value?.type === "chat.retry" && typeof value.retryFile === "string") {
      return value.retryFile;
    }
  }
  return undefined;
}
