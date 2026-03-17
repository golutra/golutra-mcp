export declare function buildToolSuccess<T extends object>(summary: string, structuredContent: T): {
    content: Array<{
        type: "text";
        text: string;
    }>;
    structuredContent: Record<string, unknown>;
};
export declare function buildToolError(error: unknown): {
    content: Array<{
        type: "text";
        text: string;
    }>;
    structuredContent: Record<string, unknown>;
    isError: true;
};
