export class CliExecutionError extends Error {
    cliPath;
    args;
    exitCode;
    stdout;
    stderr;
    code;
    requestId;
    constructor(options) {
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
//# sourceMappingURL=errors.js.map