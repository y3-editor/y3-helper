/**
 * MCP 配置 Zod Schema
 * 移植自 CodeMaker 源码版 mcpHandlers/schema.ts
 */

import { z } from "zod";

const TYPE_ERROR_MESSAGE = "Server type must be one of: 'stdio', 'sse', or 'streamableHttp'";
const DEFAULT_MCP_TIMEOUT_SECONDS = 60;
const MIN_MCP_TIMEOUT_SECONDS = 1;

export const AutoApproveSchema = z.array(z.string()).default([]);

export const BaseConfigSchema = z.object({
    disabled: z.boolean().optional(),
    timeout: z.number().min(MIN_MCP_TIMEOUT_SECONDS).optional().default(DEFAULT_MCP_TIMEOUT_SECONDS),
    autoApprove: z.boolean().optional(),
    autoApproveTools: AutoApproveSchema.optional(),
});

const createServerTypeSchema = () => {
    return z.union([
        // Stdio config (has command field)
        BaseConfigSchema.extend({
            type: z.literal("stdio").optional(),
            command: z.string(),
            args: z.array(z.string()).optional(),
            cwd: z.string().optional(),
            env: z.record(z.string()).optional(),
            url: z.undefined().optional(),
            headers: z.undefined().optional(),
            enableCustomAuth: z.boolean().optional(),
        })
            .transform((data) => ({ ...data, type: "stdio" as const }))
            .refine((data) => data.type === undefined || data.type === "stdio", { message: TYPE_ERROR_MESSAGE }),
        // SSE config (has url field)
        BaseConfigSchema.extend({
            type: z.literal("sse").optional(),
            url: z.string().url("URL must be a valid URL format"),
            headers: z.record(z.string()).optional(),
            command: z.undefined().optional(),
            args: z.undefined().optional(),
            env: z.undefined().optional(),
            enableCustomAuth: z.boolean().optional(),
        })
            .transform((data) => ({ ...data, type: "sse" as const }))
            .refine((data) => data.type === undefined || data.type === "sse", { message: TYPE_ERROR_MESSAGE }),
        // Streamable HTTP config (has url field)
        BaseConfigSchema.extend({
            type: z.literal("streamableHttp").optional(),
            url: z.string().url("URL must be a valid URL format"),
            headers: z.record(z.string()).optional(),
            command: z.undefined().optional(),
            args: z.undefined().optional(),
            env: z.undefined().optional(),
            enableCustomAuth: z.boolean().optional(),
        })
            .transform((data) => ({ ...data, type: "streamableHttp" as const }))
            .refine((data) => data.type === undefined || data.type === "streamableHttp", { message: TYPE_ERROR_MESSAGE }),
    ]);
};

export const ServerConfigSchema = createServerTypeSchema();

export const McpSettingsSchema = z.object({
    mcpServers: z.record(ServerConfigSchema),
});
