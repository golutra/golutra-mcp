import type { CommandContextInput, RuntimeContextSnapshot } from "./types.js";
export declare function resolveDefaultCliPath(env: NodeJS.ProcessEnv, options?: {
    platform?: NodeJS.Platform;
    homeDirectory?: string;
    pathExists?: (candidatePath: string) => boolean;
}): string;
export declare function createInitialContext(env: NodeJS.ProcessEnv): RuntimeContextSnapshot;
export declare class ContextStore {
    private readonly initialContext;
    private context;
    constructor(initialContext: RuntimeContextSnapshot);
    getSnapshot(): RuntimeContextSnapshot;
    reset(): RuntimeContextSnapshot;
    private mergeContext;
    update(nextValues: CommandContextInput): RuntimeContextSnapshot;
    resolveCommandContext(nextValues?: CommandContextInput): RuntimeContextSnapshot;
    requireWorkspacePath(nextValues?: CommandContextInput): string;
}
