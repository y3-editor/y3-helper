export const RUNTIME_UI_TOUCH_OPTIONS = ['左键', '右键'] as const;

export type RuntimeUiTouch = (typeof RUNTIME_UI_TOUCH_OPTIONS)[number];

export const RUNTIME_UI_TOUCH_BUTTONS: Record<RuntimeUiTouch, 0 | 1> = {
    '左键': 0,
    '右键': 1,
};

export const RUNTIME_UI_TIMEOUT_MS = 3000;

export type RuntimeUiCenterResult =
    | { ok: true; x: number; y: number }
    | { ok: false; code: string; message: string };

export type RuntimeUiTouchResult =
    | { ok: true; success: boolean }
    | { ok: false; code: string; message: string };

export interface RuntimeUiStripResult {
    matched: boolean;
    payload?: string;
    remaining: string;
}

export type RuntimeUiPrintListener = (message: string) => {
    matched: boolean;
    remaining: string;
};

export type RuntimeUiAbortHandler = (
    code: 'CLIENT_NOT_CONNECTED',
    message: string
) => void;

export interface RuntimeUiCallOptions {
    sendCommand: (luaCode: string) => void;
    subscribePrint: (
        listener: RuntimeUiPrintListener,
        onAbort?: RuntimeUiAbortHandler
    ) => () => void;
    luaCode: string;
    requestId: string;
    timeoutMs?: number;
}

export type RuntimeUiLuaCallResult =
    | { ok: true; payload: string }
    | { ok: false; code: 'RUNTIME_UI_TIMEOUT' | 'COMMAND_SEND_FAILED' | 'CLIENT_NOT_CONNECTED'; message: string };

export interface RuntimeClientCandidate {
    slot: number;
    name: string;
    roleId?: number;
}

export type ResolveRuntimeClientResult<T extends RuntimeClientCandidate> =
    | { ok: true; client: T; slot: number }
    | { ok: false; code: 'INVALID_PARAMS' | 'GAME_NOT_RUNNING' | 'CLIENT_NOT_CONNECTED'; message: string };

const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*m/g;
const CONSOLE_LEVEL_PREFIX_RE = /^(?:\[(?:fatal|error|warn|info|debug)\s*\](?:\[\d{2}:\d{2}:\d{2}\])?)?\s*$/i;
const TRAILING_ANSI_LINE_RE = /^(?:\r?\n)(?:\x1b\[[0-9;]*m)+(?=\r?\n|$)/;

/**
 * Quote an arbitrary string as a safe Lua double-quoted literal, escaping all ASCII control bytes.
 */
export function quoteLuaString(value: string): string {
    let escaped = '';
    for (let i = 0; i < value.length; i += 1) {
        const ch = value[i];
        const code = value.charCodeAt(i);
        if (ch === '\\') {
            escaped += '\\\\';
        } else if (ch === '"') {
            escaped += '\\"';
        } else if (ch === '\r') {
            escaped += '\\r';
        } else if (ch === '\n') {
            escaped += '\\n';
        } else if (ch === '\t') {
            escaped += '\\t';
        } else if (code < 0x20) {
            escaped += `\\${String(code).padStart(3, '0')}`;
        } else {
            escaped += ch;
        }
    }
    return `"${escaped}"`;
}

/**
 * Type guard checking whether a string is a supported runtime UI touch label.
 */
export function isRuntimeUiTouch(value: string): value is RuntimeUiTouch {
    return Object.prototype.hasOwnProperty.call(RUNTIME_UI_TOUCH_BUTTONS, value);
}

/**
 * Build unique start/end markers used to frame internal JSON output from Lua console prints.
 */
export function getRuntimeUiMarkers(requestId: string): { start: string; end: string } {
    return {
        start: `__Y3_MCP_UI_BEGIN_${requestId}__`,
        end: `__Y3_MCP_UI_END_${requestId}__`,
    };
}

function collapseLineRemoval(beforeLine: string, afterLineWithNewline: string): string {
    if (afterLineWithNewline.startsWith('\r\n')) {
        return beforeLine + afterLineWithNewline.slice(2);
    }
    if (afterLineWithNewline.startsWith('\n')) {
        return beforeLine + afterLineWithNewline.slice(1);
    }
    if (beforeLine.endsWith('\r\n') && afterLineWithNewline === '') {
        return beforeLine.slice(0, -2);
    }
    if (beforeLine.endsWith('\n') && afterLineWithNewline === '') {
        return beforeLine.slice(0, -1);
    }
    return beforeLine + afterLineWithNewline;
}

/**
 * Extract and strip the framed JSON payload for a given requestId, preserving surrounding
 * ordinary log text while discarding empty ANSI/log-level wrappers on the matched line.
 */
export function consumeFramedPayload(message: string, requestId: string): RuntimeUiStripResult {
    const { start, end } = getRuntimeUiMarkers(requestId);
    const startIdx = message.indexOf(start);
    if (startIdx < 0) {
        return { matched: false, remaining: message };
    }
    const payloadStart = startIdx + start.length;
    const endIdx = message.indexOf(end, payloadStart);
    if (endIdx < 0) {
        return { matched: false, remaining: message };
    }

    const payload = message.slice(payloadStart, endIdx);
    const spanEnd = endIdx + end.length;

    const prevNewline = message.lastIndexOf('\n', startIdx - 1);
    const lineStart = prevNewline >= 0 ? prevNewline + 1 : 0;
    const nextNewline = message.indexOf('\n', spanEnd);
    let lineEnd = nextNewline >= 0 ? nextNewline : message.length;

    const linePrefix = message.slice(lineStart, startIdx).replace(ANSI_ESCAPE_RE, '');
    const lineSuffix = message.slice(spanEnd, lineEnd).replace(ANSI_ESCAPE_RE, '').replace(/\r/g, '');

    let remaining: string;
    if (CONSOLE_LEVEL_PREFIX_RE.test(linePrefix) && lineSuffix.trim().length === 0) {
        // Consume an orphaned ANSI reset line (e.g. from `COLOR + msg_with_crlf + RESET`) without touching real text.
        const trailingAnsi = TRAILING_ANSI_LINE_RE.exec(message.slice(lineEnd));
        if (trailingAnsi) {
            lineEnd += trailingAnsi[0].length;
        }
        const beforeLine = message.slice(0, lineStart);
        const afterLine = message.slice(lineEnd);
        remaining = collapseLineRemoval(beforeLine, afterLine);
        if (remaining.replace(ANSI_ESCAPE_RE, '').trim().length === 0) {
            remaining = '';
        }
    } else {
        remaining = message.slice(0, startIdx) + message.slice(spanEnd);
    }

    return { matched: true, payload, remaining };
}

/**
 * Run all print listeners sequentially without short-circuiting so co-batched markers and ordinary
 * log lines are both preserved accurately.
 */
export function dispatchPrintListeners(
    listeners: Iterable<RuntimeUiPrintListener>,
    message: string
): { anyMatched: boolean; remaining: string } {
    let remaining = message;
    let anyMatched = false;
    for (const listener of [...listeners]) {
        const result = listener(remaining);
        if (result.matched) {
            anyMatched = true;
            remaining = result.remaining;
        }
    }
    return { anyMatched, remaining };
}

function buildGameApiCallLua(
    requestId: string,
    methodName: string,
    luaArgs: string,
    onSuccessLua: string
): string {
    const { start, end } = getRuntimeUiMarkers(requestId);
    return [
        '(function()',
        `local _S = ${quoteLuaString(start)}`,
        `local _E = ${quoteLuaString(end)}`,
        'local _hex = "0123456789abcdef"',
        'local function _esc(v)',
        '  local s = tostring(v)',
        '  if #s > 1000 then',
        '    local n = 1000',
        '    while n > 0 do',
        '      local b = string.byte(s, n + 1)',
        '      if not b or b < 128 or b >= 192 then break end',
        '      n = n - 1',
        '    end',
        '    s = string.sub(s, 1, n) .. "..."',
        '  end',
        '  s = string.gsub(s, "\\\\", "\\\\\\\\")',
        '  s = string.gsub(s, "\\"", "\\\\\\"")',
        '  s = string.gsub(s, "\\r", "\\\\r")',
        '  s = string.gsub(s, "\\n", "\\\\n")',
        '  s = string.gsub(s, "\\t", "\\\\t")',
        '  s = string.gsub(s, "[\\0-\\31]", function(c)',
        '    local b = string.byte(c)',
        '    local hi = math.floor(b / 16) + 1',
        '    local lo = (b % 16) + 1',
        '    return "\\\\u00" .. string.sub(_hex, hi, hi) .. string.sub(_hex, lo, lo)',
        '  end)',
        '  return s',
        'end',
        'local function _emit(json)',
        '  return setmetatable({}, { __tostring = function() return _S .. json .. _E end })',
        'end',
        'local function _err(code, msg)',
        '  return _emit("{\\"ok\\":false,\\"code\\":\\"" .. _esc(code) .. "\\",\\"message\\":\\"" .. _esc(msg) .. "\\"}")',
        'end',
        `local ok_fn, fn = pcall(function() return GameAPI and GameAPI.${methodName} end)`,
        'if not ok_fn or fn == nil then',
        `  return _err("API_UNAVAILABLE", "GameAPI.${methodName} is not available in this engine version")`,
        'end',
        `local ok_call, r1, r2 = pcall(fn, ${luaArgs})`,
        'if not ok_call then',
        '  return _err("LUA_ERROR", r1)',
        'end',
        onSuccessLua,
        'end)()',
    ].join('\n');
}

/**
 * Build Lua code to query UI control screen center coordinates via GameAPI.get_ui_center_by_path.
 */
export function buildGetUiCenterLua(uiPath: string, requestId: string): string {
    const onSuccessLua = [
        'if r1 == nil or r1 == false then',
        '  return _err("UI_NOT_FOUND", "UI node not found")',
        'end',
        'local function _num(v)',
        '  if v == nil then return nil end',
        '  if type(v) == "number" then return v end',
        '  if python ~= nil then',
        '    local ok_n, n = pcall(function() return python.to_number(v) end)',
        '    if ok_n and type(n) == "number" then return n end',
        '  end',
        '  return tonumber(v)',
        'end',
        'local x = _num(r1)',
        'local y = _num(r2)',
        'if (x == nil or y == nil) and python_index ~= nil then',
        '  local ok_pi, px, py = pcall(function() return python_index(r1, 0), python_index(r1, 1) end)',
        '  if ok_pi then',
        '    x = _num(px)',
        '    y = _num(py)',
        '  end',
        'end',
        'if x == nil or y == nil then',
        '  local ok_0, p0, p1 = pcall(function() return r1[0], r1[1] end)',
        '  if ok_0 then',
        '    x = _num(p0)',
        '    y = _num(p1)',
        '  end',
        'end',
        'if x == nil or y == nil then',
        '  local ok_1, l1, l2 = pcall(function() return r1[1], r1[2] end)',
        '  if ok_1 then',
        '    x = _num(l1)',
        '    y = _num(l2)',
        '  end',
        'end',
        'if x == nil or y == nil or x ~= x or y ~= y or math.abs(x) == math.huge or math.abs(y) == math.huge then',
        '  return _err("INVALID_RESULT", "Unexpected return value from GameAPI.get_ui_center_by_path")',
        'end',
        'return _emit("{\\"ok\\":true,\\"x\\":" .. tostring(math.floor(x)) .. ",\\"y\\":" .. tostring(math.floor(y)) .. "}")',
    ].join('\n');
    return buildGameApiCallLua(requestId, 'get_ui_center_by_path', quoteLuaString(uiPath), onSuccessLua);
}

/**
 * Build Lua code to trigger a UI click event via GameAPI.trigger_ui_touch_event_by_path.
 */
export function buildTriggerUiTouchLua(uiPath: string, touch: RuntimeUiTouch, requestId: string): string {
    const button = RUNTIME_UI_TOUCH_BUTTONS[touch];
    const onSuccessLua = 'return _emit("{\\"ok\\":true,\\"success\\":" .. (r1 and "true" or "false") .. "}")';
    return buildGameApiCallLua(
        requestId,
        'trigger_ui_touch_event_by_path',
        `${quoteLuaString(uiPath)}, ${button}`,
        onSuccessLua
    );
}

function parseRuntimeUiEnvelope<T>(
    rawJson: string,
    validateSuccess: (parsed: Record<string, unknown>) => T | undefined,
    invalidSuccessMessage: string
): ({ ok: true } & T) | { ok: false; code: string; message: string } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawJson);
    } catch {
        return {
            ok: false,
            code: 'INVALID_RESULT',
            message: 'Invalid JSON payload from Lua runtime',
        };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
            ok: false,
            code: 'INVALID_RESULT',
            message: 'Invalid JSON payload from Lua runtime',
        };
    }

    const record = parsed as Record<string, unknown>;
    if (record.ok === false) {
        const code = typeof record.code === 'string' && record.code.length > 0
            ? record.code
            : 'RUNTIME_UI_ERROR';
        const message = typeof record.message === 'string' && record.message.length > 0
            ? record.message
            : 'Unknown runtime UI error';
        return { ok: false, code, message };
    }

    if (record.ok === true) {
        const value = validateSuccess(record);
        if (value !== undefined) {
            return { ok: true, ...value };
        }
        return {
            ok: false,
            code: 'INVALID_RESULT',
            message: invalidSuccessMessage,
        };
    }

    return {
        ok: false,
        code: 'INVALID_RESULT',
        message: 'Malformed response from Lua runtime',
    };
}

/**
 * Parse and validate the JSON payload produced by buildGetUiCenterLua.
 */
export function parseUiCenterPayload(rawJson: string): RuntimeUiCenterResult {
    return parseRuntimeUiEnvelope(
        rawJson,
        (record) => {
            if (
                typeof record.x === 'number'
                && Number.isFinite(record.x)
                && typeof record.y === 'number'
                && Number.isFinite(record.y)
            ) {
                return { x: record.x, y: record.y };
            }
            return undefined;
        },
        'Invalid coordinates in Lua runtime response'
    );
}

/**
 * Parse and validate the JSON payload produced by buildTriggerUiTouchLua.
 */
export function parseUiTouchPayload(rawJson: string): RuntimeUiTouchResult {
    return parseRuntimeUiEnvelope(
        rawJson,
        (record) => {
            if (typeof record.success === 'boolean') {
                return { success: record.success };
            }
            return undefined;
        },
        'Invalid success flag in Lua runtime response'
    );
}

/**
 * Resolve which connected game client should execute a runtime UI tool call.
 */
export function resolveRuntimeTargetClient<T extends RuntimeClientCandidate>(options: {
    allClients: readonly T[];
    sessionClient?: T;
    clientSlot?: number;
    roleId?: number;
}): ResolveRuntimeClientResult<T> {
    const { allClients, sessionClient, clientSlot, roleId } = options;
    if (typeof clientSlot === 'number' && typeof roleId === 'number') {
        return {
            ok: false,
            code: 'INVALID_PARAMS',
            message: 'clientSlot and roleId are mutually exclusive.',
        };
    }
    if (allClients.length === 0) {
        return {
            ok: false,
            code: 'GAME_NOT_RUNNING',
            message: 'Game is not running or no client is connected. Call launch_game and confirm via get_game_status first.',
        };
    }
    if (typeof clientSlot === 'number') {
        const client = allClients.find((candidate) => candidate.slot === clientSlot);
        if (!client) {
            return {
                ok: false,
                code: 'CLIENT_NOT_CONNECTED',
                message: `Client slot ${clientSlot} not found, total clients: ${allClients.length}`,
            };
        }
        return { ok: true, client, slot: clientSlot };
    }
    if (typeof roleId === 'number') {
        const client = allClients.find((candidate) => candidate.roleId === roleId);
        if (!client) {
            const knownRoles = allClients
                .map((candidate) => candidate.roleId)
                .filter((role): role is number => role !== undefined)
                .join(', ') || '(none)';
            return {
                ok: false,
                code: 'CLIENT_NOT_CONNECTED',
                message: `Client for role ${roleId} not found. Known roles: ${knownRoles}`,
            };
        }
        return { ok: true, client, slot: client.slot };
    }
    if (sessionClient && allClients.includes(sessionClient)) {
        return { ok: true, client: sessionClient, slot: sessionClient.slot };
    }
    const client = allClients[allClients.length - 1];
    return { ok: true, client, slot: client.slot };
}

/**
 * Send a Lua command and wait for its framed print response with timeout cleanup.
 */
export async function runRuntimeUiLuaCall(options: RuntimeUiCallOptions): Promise<RuntimeUiLuaCallResult> {
    const timeoutMs = options.timeoutMs ?? RUNTIME_UI_TIMEOUT_MS;

    return await new Promise<RuntimeUiLuaCallResult>((resolve) => {
        let settled = false;
        let timer: NodeJS.Timeout | undefined;
        let unsubscribe: (() => void) | undefined;

        const finish = (result: RuntimeUiLuaCallResult) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = undefined;
            }
            resolve(result);
        };

        const unsub = options.subscribePrint(
            (msg: string) => {
                const stripped = consumeFramedPayload(msg, options.requestId);
                if (!stripped.matched || stripped.payload === undefined) {
                    return { matched: false, remaining: msg };
                }
                finish({ ok: true, payload: stripped.payload });
                return { matched: true, remaining: stripped.remaining };
            },
            (code, message) => {
                finish({ ok: false, code, message });
            }
        );

        if (settled) {
            unsub();
            return;
        }
        unsubscribe = unsub;

        timer = setTimeout(() => {
            finish({
                ok: false,
                code: 'RUNTIME_UI_TIMEOUT',
                message: `Timed out after ${timeoutMs}ms waiting for runtime UI response`,
            });
        }, timeoutMs);

        try {
            options.sendCommand(options.luaCode);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            finish({
                ok: false,
                code: 'COMMAND_SEND_FAILED',
                message: `Failed to send Lua command: ${message}`,
            });
        }
    });
}
