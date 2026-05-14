export type McpToolArguments =
    | { ok: true; value: Record<string, unknown> }
    | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidMcpArgumentsMessage(reason: string): string {
    return `Invalid MCP tool arguments: expected a JSON object/record for params.arguments; ${reason}.`;
}

export function normalizeMcpToolArguments(value: unknown): McpToolArguments {
    if (value === undefined || value === null) {
        return { ok: true, value: {} };
    }

    if (typeof value === 'string') {
        if (value.trim() === '') {
            return { ok: true, value: {} };
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(value);
        } catch (error: any) {
            return {
                ok: false,
                message: invalidMcpArgumentsMessage(`received a string that is not valid JSON (${error?.message || 'parse failed'})`),
            };
        }

        if (!isRecord(parsed)) {
            return {
                ok: false,
                message: invalidMcpArgumentsMessage(`parsed JSON was ${Array.isArray(parsed) ? 'an array' : typeof parsed}`),
            };
        }

        return { ok: true, value: parsed };
    }

    if (isRecord(value)) {
        return { ok: true, value };
    }

    return {
        ok: false,
        message: invalidMcpArgumentsMessage(`received ${Array.isArray(value) ? 'an array' : typeof value}`),
    };
}
