import type { CliCommandRequest } from "./types.js";
export interface CliJsonRunner {
    executeJson<T>(request: CliCommandRequest): Promise<T>;
    executeText?(request: CliCommandRequest): Promise<string>;
}
export declare class NodeCliJsonRunner implements CliJsonRunner {
    private executeRaw;
    executeText(request: CliCommandRequest): Promise<string>;
    executeJson<T>(request: CliCommandRequest): Promise<T>;
}
