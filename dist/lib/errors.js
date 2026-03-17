export class CliExecutionError extends Error {
    cliPath;
    args;
    exitCode;
    stdout;
    stderr;
    constructor(options) {
        super(options.message);
        this.name = "CliExecutionError";
        this.cliPath = options.cliPath;
        this.args = options.args;
        this.exitCode = options.exitCode;
        this.stdout = options.stdout ?? "";
        this.stderr = options.stderr ?? "";
    }
}
//# sourceMappingURL=errors.js.map