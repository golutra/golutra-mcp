import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ContextStore } from "./context.js";
import type { GolutraCliGateway } from "./golutra-client.js";
export declare const batchMessageSchema: z.ZodEffects<z.ZodObject<{
    key: z.ZodEffects<z.ZodString, string, string>;
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
}, "strict", z.ZodTypeAny, {
    text: string;
    key: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    replyTo?: string | undefined;
}, {
    text: string;
    key: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    replyTo?: string | undefined;
}>, {
    text: string;
    key: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    replyTo?: string | undefined;
}, {
    text: string;
    key: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    replyTo?: string | undefined;
}>;
export declare const batchMessagesSchema: z.ZodEffects<z.ZodArray<z.ZodEffects<z.ZodObject<{
    key: z.ZodEffects<z.ZodString, string, string>;
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
}, "strict", z.ZodTypeAny, {
    text: string;
    key: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    replyTo?: string | undefined;
}, {
    text: string;
    key: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    replyTo?: string | undefined;
}>, {
    text: string;
    key: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    replyTo?: string | undefined;
}, {
    text: string;
    key: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    replyTo?: string | undefined;
}>, "many">, {
    text: string;
    key: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    replyTo?: string | undefined;
}[], {
    text: string;
    key: string;
    to?: {
        memberId: string;
    } | {
        conversationId: string;
        mentionIds: string[];
    } | undefined;
    replyTo?: string | undefined;
}[]>;
export declare function registerChatBatchTools(server: McpServer, contextStore: ContextStore, gateway: GolutraCliGateway): void;
