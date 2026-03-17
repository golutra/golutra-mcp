export class CliExecutionError extends Error {
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
  }) {
    super(options.message);
    this.name = "CliExecutionError";
    this.cliPath = options.cliPath;
    this.args = options.args;
    this.exitCode = options.exitCode;
    this.stdout = options.stdout ?? "";
    this.stderr = options.stderr ?? "";
  }
}
