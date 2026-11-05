export class CliExecutionError extends Error {
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
  }
}
