import type { CliCommandRequest } from "./types.js";
export interface CliJsonRunner {
    executeJson<T>(request: CliCommandRequest): Promise<T>;
}
export declare class NodeCliJsonRunner implements CliJsonRunner {
    executeJson<T>(request: CliCommandRequest): Promise<T>;
}
