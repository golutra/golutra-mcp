import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ContextStore } from "./context.js";
import type { GolutraCliGateway } from "./golutra-client.js";
export declare const batchMessageSchema: z.ZodEffects<z.ZodObject<{
    text: z.ZodEffects<z.ZodString, string, string>;
    to: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
        memberId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        memberId: string;
    }, {
        memberId: string;
    }>, z.ZodObject<{
        conversationId: z.ZodString;
        mentionIds: z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>;
    }, "strict", z.ZodTypeAny, {
        conversationId: string;
        mentionIds: string[];
    }, {
        conversationId: string;
        mentionIds: string[];
    }>]>>;
    replyTo: z.ZodOptional<z.ZodString>;
    key: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strict", z.ZodTypeAny, {
    text: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
}, {
    text: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
}>, {
    text: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
}, {
    text: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
}>;
export declare const batchMessagesSchema: z.ZodEffects<z.ZodArray<z.ZodEffects<z.ZodObject<{
    text: z.ZodEffects<z.ZodString, string, string>;
    to: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
        memberId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        memberId: string;
    }, {
        memberId: string;
    }>, z.ZodObject<{
        conversationId: z.ZodString;
        mentionIds: z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>;
    }, "strict", z.ZodTypeAny, {
        conversationId: string;
        mentionIds: string[];
    }, {
        conversationId: string;
        mentionIds: string[];
    }>]>>;
    replyTo: z.ZodOptional<z.ZodString>;
    key: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strict", z.ZodTypeAny, {
    text: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
}, {
    text: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
}>, {
    text: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
}, {
    text: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
}>, "many">, {
    text: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
}[], {
    text: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
}[]>;
export declare const chatSendSchema: z.ZodEffects<z.ZodObject<{
    senderId: z.ZodOptional<z.ZodString>;
    workspacePath: z.ZodOptional<z.ZodString>;
    profile: z.ZodOptional<z.ZodEnum<["dev", "canary", "stable"]>>;
    text: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    messages: z.ZodOptional<z.ZodEffects<z.ZodArray<z.ZodEffects<z.ZodObject<{
        text: z.ZodEffects<z.ZodString, string, string>;
        to: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
            memberId: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            memberId: string;
        }, {
            memberId: string;
        }>, z.ZodObject<{
            conversationId: z.ZodString;
            mentionIds: z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>;
        }, "strict", z.ZodTypeAny, {
            conversationId: string;
            mentionIds: string[];
        }, {
            conversationId: string;
            mentionIds: string[];
        }>]>>;
        replyTo: z.ZodOptional<z.ZodString>;
        key: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    }, "strict", z.ZodTypeAny, {
        text: string;
        to?: {
            memberId: string;
        } | {
            conversationId: string;
            mentionIds: string[];
        } | undefined;
        key?: string | undefined;
        replyTo?: string | undefined;
    }, {
        text: string;
        to?: {
            memberId: string;
        } | {
            conversationId: string;
            mentionIds: string[];
        } | undefined;
        key?: string | undefined;
        replyTo?: string | undefined;
    }>, {
        text: string;
        to?: {
            memberId: string;
        } | {
            conversationId: string;
            mentionIds: string[];
        } | undefined;
        key?: string | undefined;
        replyTo?: string | undefined;
    }, {
        text: string;
        to?: {
            memberId: string;
        } | {
            conversationId: string;
            mentionIds: string[];
        } | undefined;
        key?: string | undefined;
        replyTo?: string | undefined;
    }>, "many">, {
        text: string;
        to?: {
            memberId: string;
        } | {
            conversationId: string;
            mentionIds: string[];
        } | undefined;
        key?: string | undefined;
        replyTo?: string | undefined;
    }[], {
        text: string;
        to?: {
            memberId: string;
        } | {
            conversationId: string;
            mentionIds: string[];
        } | undefined;
        key?: string | undefined;
        replyTo?: string | undefined;
    }[]>>;
    retryFile: z.ZodOptional<z.ZodString>;
    requestId: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    batchId: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
        memberId: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        memberId: string;
    }, {
        memberId: string;
    }>, z.ZodObject<{
        conversationId: z.ZodString;
        mentionIds: z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>;
    }, "strict", z.ZodTypeAny, {
        conversationId: string;
        mentionIds: string[];
    }, {
        conversationId: string;
        mentionIds: string[];
    }>]>>;
    replyTo: z.ZodOptional<z.ZodString>;
    key: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strict", z.ZodTypeAny, {
    retryFile?: string | undefined;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    requestId?: string | undefined;
    profile?: "dev" | "canary" | "stable" | undefined;
    text?: string | undefined;
    workspacePath?: string | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
    messages?: {
        text: string;
        to?: {
            memberId: string;
        } | {
            conversationId: string;
            mentionIds: string[];
        } | undefined;
        key?: string | undefined;
        replyTo?: string | undefined;
    }[] | undefined;
    batchId?: string | undefined;
    senderId?: string | undefined;
}, {
    retryFile?: string | undefined;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    requestId?: string | undefined;
    profile?: "dev" | "canary" | "stable" | undefined;
    text?: string | undefined;
    workspacePath?: string | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
    messages?: {
        text: string;
        to?: {
            memberId: string;
        } | {
            conversationId: string;
            mentionIds: string[];
        } | undefined;
        key?: string | undefined;
        replyTo?: string | undefined;
    }[] | undefined;
    batchId?: string | undefined;
    senderId?: string | undefined;
}>, {
    retryFile?: string | undefined;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    requestId?: string | undefined;
    profile?: "dev" | "canary" | "stable" | undefined;
    text?: string | undefined;
    workspacePath?: string | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
    messages?: {
        text: string;
        to?: {
            memberId: string;
        } | {
            conversationId: string;
            mentionIds: string[];
        } | undefined;
        key?: string | undefined;
        replyTo?: string | undefined;
    }[] | undefined;
    batchId?: string | undefined;
    senderId?: string | undefined;
}, {
    retryFile?: string | undefined;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    requestId?: string | undefined;
    profile?: "dev" | "canary" | "stable" | undefined;
    text?: string | undefined;
    workspacePath?: string | undefined;
    key?: string | undefined;
    replyTo?: string | undefined;
    messages?: {
        text: string;
        to?: {
            memberId: string;
        } | {
            conversationId: string;
            mentionIds: string[];
        } | undefined;
        key?: string | undefined;
        replyTo?: string | undefined;
    }[] | undefined;
    batchId?: string | undefined;
    senderId?: string | undefined;
}>;
export declare const chatInboxSchema: z.ZodObject<{
    senderId: z.ZodOptional<z.ZodString>;
    workspacePath: z.ZodOptional<z.ZodString>;
    profile: z.ZodOptional<z.ZodEnum<["dev", "canary", "stable"]>>;
    batchId: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    profile?: "dev" | "canary" | "stable" | undefined;
    workspacePath?: string | undefined;
    batchId?: string | undefined;
    senderId?: string | undefined;
}, {
    profile?: "dev" | "canary" | "stable" | undefined;
    workspacePath?: string | undefined;
    batchId?: string | undefined;
    senderId?: string | undefined;
}>;
export declare function registerChatBatchTools(server: McpServer, contextStore: ContextStore, gateway: GolutraCliGateway): void;
