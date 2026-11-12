export class CliExecutionError extends Error {
    cliPath;
    args;
    exitCode;
    stdout;
    stderr;
    code;
    requestId;
    response;
    retryFile;
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
        this.response = readJsonObject(this.stdout);
        // CLI 在发送前输出持久化凭据；进程被超时终止时也不能丢失原请求的重试入口。
        this.retryFile = typeof this.response?.retryFile === "string"
            ? this.response.retryFile
            : readRetryDiagnostic(this.stderr);
    }
}
function readJsonObject(text) {
    try {
        const value = JSON.parse(text);
        return value && typeof value === "object" && !Array.isArray(value)
            ? value : undefined;
    }
    catch {
        return undefined;
    }
}
function readRetryDiagnostic(stderr) {
    for (const line of stderr.split("\n").reverse()) {
        const value = readJsonObject(line);
        if (value?.type === "chat.retry" && typeof value.retryFile === "string") {
            return value.retryFile;
        }
    }
    return undefined;
}
//# sourceMappingURL=errors.js.map