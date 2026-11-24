import * as assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import * as vm from 'vm';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
    buildGetUiCenterLua,
    buildTriggerUiTouchLua,
    consumeFramedPayload,
    dispatchPrintListeners,
    getRuntimeUiMarkers,
    isRuntimeUiTouch,
    parseUiCenterPayload,
    parseUiTouchPayload,
    quoteLuaString,
    resolveRuntimeTargetClient,
    runRuntimeUiLuaCall,
    RuntimeUiPrintListener,
    RUNTIME_UI_TOUCH_BUTTONS,
} from '../../mcp/runtimeUi';

function resolveLua54Executable(): string | undefined {
    const candidate = path.resolve(__dirname, '../../../3rd/debugger/runtime/win32-x64/lua54/lua.exe');
    return fs.existsSync(candidate) ? candidate : undefined;
}

function runLuaSnippet(luaExe: string, prelude: string, generatedCode: string): string {
    const quotedCode = quoteLuaString(generatedCode);
    const script = [
        'print = function() error("global print must not be called") end',
        prelude,
        `local __code = ${quotedCode}`,
        'local fn_stmt, err_stmt = load(__code)',
        'assert(fn_stmt, "load(code) failed: " .. tostring(err_stmt))',
        'local fn_expr, err_expr = load("return " .. __code)',
        'assert(fn_expr, "load(\'return \' .. code) failed: " .. tostring(err_expr))',
        'local res = fn_expr()',
        'local mt = getmetatable(res)',
        'assert(mt and type(mt.__tostring) == "function", "expected __tostring table result")',
        'io.write(tostring(res))',
    ].join('\n');

    return execFileSync(luaExe, ['-'], {
        input: script,
        encoding: 'utf8',
    });
}

function loadGameSessionManagerWithStubs() {
    class FakeLogManager {
        static instances: FakeLogManager[] = [];
        readonly lines: string[] = [];
        constructor(public readonly sessionId: string) {
            FakeLogManager.instances.push(this);
        }
        appendLog(message: string): void {
            this.lines.push(message);
        }
        async readLogs(limit = 100): Promise<string[]> {
            return this.lines.slice(-limit);
        }
        cleanup(): void {
            // No-op stub
        }
    }

    class FakeGameClient {
        static allClients: FakeGameClient[] = [];
        readonly printed: string[] = [];
        readonly commands: string[] = [];
        constructor(
            public readonly slot: number,
            public readonly name: string,
            public roleId?: number,
        ) {
            FakeGameClient.allClients.push(this);
        }
        print(msg: string): void {
            this.printed.push(msg);
        }
        notify(method: string, params: { data: string }): void {
            if (method === 'command') {
                this.commands.push(params.data);
            }
        }
    }

    const filename = require.resolve('../../mcp/gameSessionManager');
    const localRequire = createRequire(filename);
    const module = {
        exports: {} as {
            GameSessionManager: new () => {
                getUiCenterByPath(params?: Record<string, unknown>): Promise<any>;
                triggerUiTouchEventByPath(params?: Record<string, unknown>): Promise<any>;
                dispose(): void;
            };
        },
    };
    const load = vm.runInThisContext(
        `(function(require,module,exports){${fs.readFileSync(filename, 'utf8')}\n})`
    );
    load((name: string) => {
        if (name === 'vscode') {
            return {
                Disposable: class {
                    dispose(): void {
                        // Base disposable stub
                    }
                },
            };
        }
        if (name === '../console/client') {
            return { Client: FakeGameClient };
        }
        if (name === './logManager') {
            return { LogManager: FakeLogManager };
        }
        if (name === '../launchGame') {
            return { GameLauncher: class {} };
        }
        if (name === '../env') {
            return { env: {} };
        }
        if (name === '../tools') {
            return { log: { info: () => undefined, warn: () => undefined, error: () => undefined } };
        }
        if (name === '../codemaker/mcpHandlers/index') {
            return { getMcpHub: () => undefined };
        }
        if (name === '../tools/y3SaveGmp') {
            return { save: async () => ({ success: true, message: '' }) };
        }
        if (name === '../killGame') {
            return { killGame: async () => 0 };
        }
        if (['../multiPlayerRoles', '../multiPlayerArchives', './multiLaunch', './reconnect'].includes(name)) {
            return {};
        }
        return localRequire(name);
    }, module, module.exports);

    return {
        GameSessionManager: module.exports.GameSessionManager,
        FakeGameClient,
        FakeLogManager,
    };
}

suite('Runtime UI MCP helpers', () => {
    test('quoteLuaString escapes quotes, backslashes, all control chars 0x00-0x1f, and preserves Chinese dots', () => {
        const raw = '主界面.背包\\"按钮"\n第二行\t\r\0\x1b\x1f';
        const quoted = quoteLuaString(raw);
        assert.strictEqual(quoted, '"主界面.背包\\\\\\"按钮\\"\\n第二行\\t\\r\\000\\027\\031"');
    });

    test('isRuntimeUiTouch and RUNTIME_UI_TOUCH_BUTTONS map 左键 and 右键 only', () => {
        assert.strictEqual(isRuntimeUiTouch('左键'), true);
        assert.strictEqual(isRuntimeUiTouch('右键'), true);
        assert.strictEqual(isRuntimeUiTouch('中键'), false);
        assert.strictEqual(isRuntimeUiTouch(''), false);
        assert.strictEqual(isRuntimeUiTouch('toString'), false);

        assert.strictEqual(RUNTIME_UI_TOUCH_BUTTONS['左键'], 0);
        assert.strictEqual(RUNTIME_UI_TOUCH_BUTTONS['右键'], 1);
    });

    test('consumeFramedPayload strips only matched markers and removes empty ANSI/prefix wrappers', () => {
        const requestId = 'req123';
        const { start, end } = getRuntimeUiMarkers(requestId);
        const json = '{"ok":true,"x":640,"y":360}';

        assert.deepStrictEqual(consumeFramedPayload(`${start}${json}${end}`, requestId), {
            matched: true,
            payload: json,
            remaining: '',
        });

        const ansiLog = `\x1b[36m[info ][16:25:01] ${start}${json}${end}\r\n\x1b[0m`;
        assert.deepStrictEqual(consumeFramedPayload(ansiLog, requestId), {
            matched: true,
            payload: json,
            remaining: '',
        });

        const batchedAnsi = `ordinary before\n\x1b[36m[info ][16:25:01] ${start}${json}${end}\x1b[0m\nordinary after`;
        assert.deepStrictEqual(consumeFramedPayload(batchedAnsi, requestId), {
            matched: true,
            payload: json,
            remaining: 'ordinary before\nordinary after',
        });

        const batchedCrlfAnsi = `ordinary before\n\x1b[36m[info ][16:25:01] ${start}${json}${end}\r\n\x1b[0m\nordinary after`;
        assert.deepStrictEqual(consumeFramedPayload(batchedCrlfAnsi, requestId), {
            matched: true,
            payload: json,
            remaining: 'ordinary before\nordinary after',
        });

        const batched = `ordinary before\n${start}${json}${end}\nordinary after`;
        assert.deepStrictEqual(consumeFramedPayload(batched, requestId), {
            matched: true,
            payload: json,
            remaining: 'ordinary before\nordinary after',
        });

        const crlfBatched = `ordinary before\r\n${start}${json}${end}\r\nordinary after`;
        assert.deepStrictEqual(consumeFramedPayload(crlfBatched, requestId), {
            matched: true,
            payload: json,
            remaining: 'ordinary before\r\nordinary after',
        });

        assert.deepStrictEqual(consumeFramedPayload(`${start}${json}${end}`, 'otherReq'), {
            matched: false,
            remaining: `${start}${json}${end}`,
        });
        assert.strictEqual(consumeFramedPayload('ordinary log line', requestId).payload, undefined);
        assert.strictEqual(consumeFramedPayload(`${start}${json}`, requestId).payload, undefined);
    });

    test('dispatchPrintListeners runs all listeners without short-circuiting and keeps ordinary lines', async () => {
        const listeners = new Set<RuntimeUiPrintListener>();
        const subscribePrint = (listener: RuntimeUiPrintListener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        };

        const reqA = 'aaa111';
        const reqB = 'bbb222';
        const markersA = getRuntimeUiMarkers(reqA);
        const markersB = getRuntimeUiMarkers(reqB);
        let dispatchOutcome: { anyMatched: boolean; remaining: string } | undefined;

        const callA = runRuntimeUiLuaCall({
            requestId: reqA,
            luaCode: 'codeA',
            timeoutMs: 500,
            subscribePrint,
            sendCommand: () => {
                // Emitted after callB subscribes
            },
        });

        const callB = runRuntimeUiLuaCall({
            requestId: reqB,
            luaCode: 'codeB',
            timeoutMs: 500,
            subscribePrint,
            sendCommand: () => {
                const batched = [
                    'ordinary before',
                    `${markersA.start}{"ok":true,"x":10,"y":20}${markersA.end}`,
                    `${markersB.start}{"ok":true,"success":true}${markersB.end}`,
                    'ordinary after',
                ].join('\n');
                dispatchOutcome = dispatchPrintListeners(listeners, batched);
            },
        });

        const [resA, resB] = await Promise.all([callA, callB]);
        assert.deepStrictEqual(resA, { ok: true, payload: '{"ok":true,"x":10,"y":20}' });
        assert.deepStrictEqual(resB, { ok: true, payload: '{"ok":true,"success":true}' });
        assert.deepStrictEqual(dispatchOutcome, {
            anyMatched: true,
            remaining: 'ordinary before\nordinary after',
        });
        assert.strictEqual(listeners.size, 0);
    });

    test('parseUiCenterPayload validates success, errors, and malformed inputs', () => {
        assert.deepStrictEqual(
            parseUiCenterPayload('{"ok":true,"x":120,"y":340}'),
            { ok: true, x: 120, y: 340 }
        );
        assert.deepStrictEqual(
            parseUiCenterPayload('{"ok":false,"code":"UI_NOT_FOUND","message":"UI node not found"}'),
            { ok: false, code: 'UI_NOT_FOUND', message: 'UI node not found' }
        );
        assert.strictEqual(parseUiCenterPayload('not-json').ok, false);
        for (const bad of ['{"ok":true,"x":"120","y":340}', '{"ok":true,"x":null,"y":340}', '[]']) {
            const parsed = parseUiCenterPayload(bad);
            assert.strictEqual(parsed.ok, false);
            if (!parsed.ok) {
                assert.strictEqual(parsed.code, 'INVALID_RESULT');
            }
        }
    });

    test('parseUiTouchPayload validates boolean success and errors', () => {
        assert.deepStrictEqual(
            parseUiTouchPayload('{"ok":true,"success":true}'),
            { ok: true, success: true }
        );
        assert.deepStrictEqual(
            parseUiTouchPayload('{"ok":true,"success":false}'),
            { ok: true, success: false }
        );
        assert.deepStrictEqual(
            parseUiTouchPayload('{"ok":false,"code":"API_UNAVAILABLE","message":"missing"}'),
            { ok: false, code: 'API_UNAVAILABLE', message: 'missing' }
        );
        for (const bad of ['{"ok":true,"success":"yes"}', '{bad']) {
            const parsed = parseUiTouchPayload(bad);
            assert.strictEqual(parsed.ok, false);
            if (!parsed.ok) {
                assert.strictEqual(parsed.code, 'INVALID_RESULT');
            }
        }
    });

    test('runRuntimeUiLuaCall handles synchronous subscribePrint settlement without leaking listener', async () => {
        const listeners = new Set<RuntimeUiPrintListener>();
        const reqId = 'sync1';
        const markers = getRuntimeUiMarkers(reqId);
        let unsubCalls = 0;

        const res = await runRuntimeUiLuaCall({
            requestId: reqId,
            luaCode: 'syncCode',
            timeoutMs: 500,
            subscribePrint: (listener) => {
                listeners.add(listener);
                listener(`${markers.start}{"ok":true,"x":1,"y":2}${markers.end}`);
                return () => {
                    unsubCalls += 1;
                    listeners.delete(listener);
                };
            },
            sendCommand: () => {
                throw new Error('should not run after synchronous settle');
            },
        });

        assert.deepStrictEqual(res, { ok: true, payload: '{"ok":true,"x":1,"y":2}' });
        assert.strictEqual(listeners.size, 0);
        assert.strictEqual(unsubCalls, 1);
    });

    test('runRuntimeUiLuaCall times out cleanly and unsubscribes', async () => {
        const listeners = new Set<RuntimeUiPrintListener>();
        const res = await runRuntimeUiLuaCall({
            requestId: 'timeout1',
            luaCode: 'noop',
            timeoutMs: 30,
            subscribePrint: (listener) => {
                listeners.add(listener);
                return () => {
                    listeners.delete(listener);
                };
            },
            sendCommand: () => {
                // No response emitted
            },
        });

        assert.strictEqual(res.ok, false);
        if (!res.ok) {
            assert.strictEqual(res.code, 'RUNTIME_UI_TIMEOUT');
        }
        assert.strictEqual(listeners.size, 0);
    });

    test('runRuntimeUiLuaCall catches sendCommand failures and unsubscribes', async () => {
        const listeners = new Set<RuntimeUiPrintListener>();
        const res = await runRuntimeUiLuaCall({
            requestId: 'senderr1',
            luaCode: 'noop',
            timeoutMs: 500,
            subscribePrint: (listener) => {
                listeners.add(listener);
                return () => {
                    listeners.delete(listener);
                };
            },
            sendCommand: () => {
                throw new Error('socket closed');
            },
        });

        assert.strictEqual(res.ok, false);
        if (!res.ok) {
            assert.strictEqual(res.code, 'COMMAND_SEND_FAILED');
            assert.ok(res.message.includes('socket closed'));
        }
        assert.strictEqual(listeners.size, 0);
    });

    test('resolveRuntimeTargetClient gates disconnected games (even with selectors), supports manual launch, and targets slots/roles', () => {
        const c0 = { slot: 0, name: 'P1【1】', roleId: 1 };
        const c1 = { slot: 1, name: 'P2【2】', roleId: 2 };

        for (const args of [{}, { clientSlot: 0 }, { roleId: 1 }]) {
            const noGame = resolveRuntimeTargetClient({ allClients: [], ...args });
            assert.strictEqual(noGame.ok, false);
            if (!noGame.ok) {
                assert.strictEqual(noGame.code, 'GAME_NOT_RUNNING');
            }
        }

        const mutual = resolveRuntimeTargetClient({
            allClients: [c0, c1],
            clientSlot: 0,
            roleId: 2,
        });
        assert.strictEqual(mutual.ok, false);
        if (!mutual.ok) {
            assert.strictEqual(mutual.code, 'INVALID_PARAMS');
        }

        const sessionSelected = resolveRuntimeTargetClient({
            allClients: [c0, c1],
            sessionClient: c0,
        });
        assert.deepStrictEqual(sessionSelected, { ok: true, client: c0, slot: 0 });

        const manualLaunch = resolveRuntimeTargetClient({
            allClients: [c0, c1],
            sessionClient: undefined,
        });
        assert.deepStrictEqual(manualLaunch, { ok: true, client: c1, slot: 1 });

        const bySlot = resolveRuntimeTargetClient({
            allClients: [c0, c1],
            clientSlot: 0,
        });
        assert.deepStrictEqual(bySlot, { ok: true, client: c0, slot: 0 });

        const byRole = resolveRuntimeTargetClient({
            allClients: [c0, c1],
            roleId: 2,
        });
        assert.deepStrictEqual(byRole, { ok: true, client: c1, slot: 1 });

        const missingSlot = resolveRuntimeTargetClient({
            allClients: [c0],
            clientSlot: 5,
        });
        assert.strictEqual(missingSlot.ok, false);
        if (!missingSlot.ok) {
            assert.strictEqual(missingSlot.code, 'CLIENT_NOT_CONNECTED');
        }

        const missingRole = resolveRuntimeTargetClient({
            allClients: [c0],
            roleId: 9,
        });
        assert.strictEqual(missingRole.ok, false);
        if (!missingRole.ok) {
            assert.strictEqual(missingRole.code, 'CLIENT_NOT_CONNECTED');
            assert.ok(missingRole.message.includes('1'));
        }
    });
});

suite('Runtime UI real Lua 5.4 execution', function () {
    const luaExe = resolveLua54Executable();

    test('buildGetUiCenterLua handles callable tables, python_index, 0/1-index, multi-return, truncation, and control chars', function () {
        if (!luaExe) {
            this.skip();
            return;
        }

        const uiPath = '主画布."背包"\\按钮';
        const requestId = 'lua54center';
        const code = buildGetUiCenterLua(uiPath, requestId);

        const outCallable = runLuaSnippet(luaExe, [
            'string.format = function() error("string.format should not be called") end',
            `local expected_path = ${quoteLuaString(uiPath)}`,
            'python_index = function(obj, i) return obj["item_" .. tostring(i)] end',
            'local callable = setmetatable({}, {',
            '  __call = function(_self, p)',
            '    assert(p == expected_path, "path mismatch: " .. tostring(p))',
            '    return { item_0 = 640, item_1 = 360 }',
            '  end',
            '})',
            'assert(type(callable) ~= "function")',
            'GameAPI = { get_ui_center_by_path = callable }',
        ].join('\n'), code);
        const payloadCallable = consumeFramedPayload(outCallable, requestId).payload;
        assert.ok(payloadCallable !== undefined);
        assert.deepStrictEqual(parseUiCenterPayload(payloadCallable), { ok: true, x: 640, y: 360 });

        const outZeroIdx = runLuaSnippet(luaExe, [
            'python_index = nil',
            'GameAPI = { get_ui_center_by_path = function() return { [0] = 100.9, [1] = 200.2 } end }',
        ].join('\n'), code);
        assert.deepStrictEqual(
            parseUiCenterPayload(consumeFramedPayload(outZeroIdx, requestId).payload ?? ''),
            { ok: true, x: 100, y: 200 }
        );

        const outOneIdx = runLuaSnippet(luaExe, [
            'python_index = nil',
            'GameAPI = { get_ui_center_by_path = function() return { 320, 240 } end }',
        ].join('\n'), code);
        assert.deepStrictEqual(
            parseUiCenterPayload(consumeFramedPayload(outOneIdx, requestId).payload ?? ''),
            { ok: true, x: 320, y: 240 }
        );

        const outMulti = runLuaSnippet(luaExe, [
            'GameAPI = { get_ui_center_by_path = function() return 800, 600 end }',
        ].join('\n'), code);
        assert.deepStrictEqual(
            parseUiCenterPayload(consumeFramedPayload(outMulti, requestId).payload ?? ''),
            { ok: true, x: 800, y: 600 }
        );

        for (const falsy of ['nil', 'false']) {
            const outNotFound = runLuaSnippet(luaExe, [
                `GameAPI = { get_ui_center_by_path = function() return ${falsy} end }`,
            ].join('\n'), code);
            assert.deepStrictEqual(
                parseUiCenterPayload(consumeFramedPayload(outNotFound, requestId).payload ?? ''),
                { ok: false, code: 'UI_NOT_FOUND', message: 'UI node not found' }
            );
        }

        const outMissing = runLuaSnippet(luaExe, 'GameAPI = {}', code);
        const parsedMissing = parseUiCenterPayload(consumeFramedPayload(outMissing, requestId).payload ?? '');
        assert.strictEqual(parsedMissing.ok, false);
        if (!parsedMissing.ok) {
            assert.strictEqual(parsedMissing.code, 'API_UNAVAILABLE');
        }

        const outCtrlErr = runLuaSnippet(luaExe, [
            'GameAPI = { get_ui_center_by_path = function() error("ansi \\x1b[31mred\\x1b[0m\\b\\f\\0\\x1f \\"quoted\\"\\nline2") end }',
        ].join('\n'), code);
        const parsedCtrlErr = parseUiCenterPayload(consumeFramedPayload(outCtrlErr, requestId).payload ?? '');
        assert.strictEqual(parsedCtrlErr.ok, false);
        if (!parsedCtrlErr.ok) {
            assert.strictEqual(parsedCtrlErr.code, 'LUA_ERROR');
            assert.ok(parsedCtrlErr.message.includes('ansi \x1b[31mred\x1b[0m\b\f\0\x1f "quoted"'));
        }

        const outHugeErr = runLuaSnippet(luaExe, [
            'GameAPI = { get_ui_center_by_path = function() error(string.rep("中文err", 3000)) end }',
        ].join('\n'), code);
        assert.ok(Buffer.byteLength(outHugeErr, 'utf8') < 10000);
        const hugePayload = consumeFramedPayload(outHugeErr, requestId).payload;
        assert.ok(hugePayload !== undefined);
        const parsedHuge = parseUiCenterPayload(hugePayload);
        assert.strictEqual(parsedHuge.ok, false);
        if (!parsedHuge.ok) {
            assert.strictEqual(parsedHuge.code, 'LUA_ERROR');
            assert.ok(parsedHuge.message.endsWith('...'));
            assert.ok(!parsedHuge.message.includes('\uFFFD'));
        }
    });

    test('buildTriggerUiTouchLua handles callable table, button 0/1, boolean returns, missing API, and errors', function () {
        if (!luaExe) {
            this.skip();
            return;
        }

        const uiPath = '主画布.技能栏.按钮1';
        const reqLeft = 'lua54left';
        const codeLeft = buildTriggerUiTouchLua(uiPath, '左键', reqLeft);
        const outLeft = runLuaSnippet(luaExe, [
            `local expected_path = ${quoteLuaString(uiPath)}`,
            'local callable = setmetatable({}, {',
            '  __call = function(_self, p, btn)',
            '    assert(p == expected_path)',
            '    assert(btn == 0, "expected 0 for 左键, got " .. tostring(btn))',
            '    return true',
            '  end',
            '})',
            'assert(type(callable) ~= "function")',
            'GameAPI = { trigger_ui_touch_event_by_path = callable }',
        ].join('\n'), codeLeft);
        assert.deepStrictEqual(
            parseUiTouchPayload(consumeFramedPayload(outLeft, reqLeft).payload ?? ''),
            { ok: true, success: true }
        );

        const reqRight = 'lua54right';
        const codeRight = buildTriggerUiTouchLua(uiPath, '右键', reqRight);
        const outRight = runLuaSnippet(luaExe, [
            'GameAPI = {',
            '  trigger_ui_touch_event_by_path = function(_p, btn)',
            '    assert(btn == 1, "expected 1 for 右键, got " .. tostring(btn))',
            '    return false',
            '  end',
            '}',
        ].join('\n'), codeRight);
        assert.deepStrictEqual(
            parseUiTouchPayload(consumeFramedPayload(outRight, reqRight).payload ?? ''),
            { ok: true, success: false }
        );

        const outMissing = runLuaSnippet(luaExe, 'GameAPI = {}', codeRight);
        const parsedMissing = parseUiTouchPayload(consumeFramedPayload(outMissing, reqRight).payload ?? '');
        assert.strictEqual(parsedMissing.ok, false);
        if (!parsedMissing.ok) {
            assert.strictEqual(parsedMissing.code, 'API_UNAVAILABLE');
        }
    });
});

suite('Runtime UI GameSessionManager and TCPServer integration', () => {
    test('GameSessionManager gates disconnected calls, forwards commands, strips markers cleanly, and keeps consistent error details', async () => {
        const { GameSessionManager, FakeGameClient, FakeLogManager } = loadGameSessionManagerWithStubs();
        const manager = new GameSessionManager();
        try {
            const notRunning = await manager.getUiCenterByPath({ ui_path: 'Canvas.Btn' });
            assert.strictEqual(notRunning.success, false);
            assert.strictEqual(notRunning.code, 'GAME_NOT_RUNNING');
            assert.deepStrictEqual(notRunning.details, { ui_path: 'Canvas.Btn' });

            const badPath = await manager.triggerUiTouchEventByPath({ ui_path: '   ', touch: '左键' });
            assert.strictEqual(badPath.success, false);
            assert.strictEqual(badPath.code, 'INVALID_PARAMS');
            assert.deepStrictEqual(badPath.details, { ui_path: '   ', touch: '左键' });

            const badTouch = await manager.triggerUiTouchEventByPath({ ui_path: 'Canvas.Btn', touch: '中键' });
            assert.strictEqual(badTouch.success, false);
            assert.strictEqual(badTouch.code, 'INVALID_PARAMS');
            assert.deepStrictEqual(badTouch.details, { ui_path: 'Canvas.Btn', touch: '中键' });

            const client = new FakeGameClient(0, '玩家1【1】', 1);
            const centerPromise = manager.getUiCenterByPath({ ui_path: 'Canvas.Btn' });
            assert.strictEqual(client.commands.length, 1);
            const matchBegin = client.commands[0].match(/__Y3_MCP_UI_BEGIN_([0-9a-f]+)__/);
            assert.ok(matchBegin);
            const markers = getRuntimeUiMarkers(matchBegin[1]);
            client.print(`ordinary1\n${markers.start}{"ok":true,"x":512,"y":384}${markers.end}\nordinary2`);

            const centerRes = await centerPromise;
            assert.deepStrictEqual(centerRes, {
                success: true,
                x: 512,
                y: 384,
                ui_path: 'Canvas.Btn',
                client_slot: 0,
                client_name: '玩家1【1】',
                role_id: 1,
            });
            assert.deepStrictEqual(client.printed, ['ordinary1\nordinary2']);
            assert.deepStrictEqual(FakeLogManager.instances[0].lines, ['ordinary1\nordinary2']);

            const touchPromise = manager.triggerUiTouchEventByPath({ ui_path: 'Canvas.Missing', touch: '右键' });
            const touchMatch = client.commands[1].match(/__Y3_MCP_UI_BEGIN_([0-9a-f]+)__/);
            assert.ok(touchMatch);
            const touchMarkers = getRuntimeUiMarkers(touchMatch[1]);
            client.print(`${touchMarkers.start}{"ok":true,"success":false}${touchMarkers.end}`);

            const touchRes = await touchPromise;
            assert.strictEqual(touchRes.success, false);
            assert.strictEqual(touchRes.code, 'UI_NOT_FOUND');
            assert.deepStrictEqual(touchRes.details, {
                ui_path: 'Canvas.Missing',
                touch: '右键',
                client_slot: 0,
                client_name: '玩家1【1】',
                role_id: 1,
            });
            assert.deepStrictEqual(client.printed, ['ordinary1\nordinary2']);

            // Disconnecting a client aborts in-flight calls immediately without waiting 3s
            const startDisconnect = Date.now();
            const disconnectedPending = manager.getUiCenterByPath({ ui_path: 'Canvas.Gone' });
            FakeGameClient.allClients.length = 0;
            const disconnectedRes = await disconnectedPending;
            assert.strictEqual(disconnectedRes.success, false);
            assert.strictEqual(disconnectedRes.code, 'CLIENT_NOT_CONNECTED');
            assert.ok(Date.now() - startDisconnect < 2000);

            // Disposing manager aborts in-flight calls immediately with no dangling timer
            new FakeGameClient(1, '玩家2【2】', 2);
            const startDispose = Date.now();
            const disposePending = manager.getUiCenterByPath({ ui_path: 'Canvas.Disposed' });
            manager.dispose();
            const disposeRes = await disposePending;
            assert.strictEqual(disposeRes.success, false);
            assert.strictEqual(disposeRes.code, 'CLIENT_NOT_CONNECTED');
            assert.ok(Date.now() - startDispose < 1000);
        } finally {
            FakeGameClient.allClients.length = 0;
            manager.dispose();
        }
    });

    test('TCPServer exposes runtime UI tools always-on and enforces Zod schema and forwarding', async () => {
        const filename = require.resolve('../../mcp/tcpServer');
        const localRequire = createRequire(filename);
        const module = {
            exports: {} as {
                TCPServer: { prototype: { createMcpServer(): McpServer } };
            },
        };
        const load = vm.runInThisContext(
            `(function(require,module,exports){${fs.readFileSync(filename, 'utf8')}\n})`
        );
        load((name: string) => {
            if (name === 'vscode') {
                return { Disposable: class {} };
            }
            if (['../tools', './gameSessionManager', '../customDefine', '../env', '../tools/gmpProject'].includes(name)) {
                return {};
            }
            return localRequire(name);
        }, module, module.exports);

        const calls: Array<{ tool: string; params: Record<string, unknown> }> = [];
        const instance = Object.create(module.exports.TCPServer.prototype) as {
            sessionManager: {
                getUiCenterByPath(params: Record<string, unknown>): Promise<unknown>;
                triggerUiTouchEventByPath(params: Record<string, unknown>): Promise<unknown>;
            };
            createMcpServer(): McpServer;
        };
        instance.sessionManager = {
            getUiCenterByPath: async (params) => {
                calls.push({ tool: 'get_ui_center_by_path', params });
                return { success: true, x: 10, y: 20, ...params };
            },
            triggerUiTouchEventByPath: async (params) => {
                calls.push({ tool: 'trigger_ui_touch_event_by_path', params });
                return { success: true, ...params };
            },
        };

        const server = instance.createMcpServer();
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        const mcpClient = new McpClient({ name: 'runtime-ui-test', version: '1' });
        await server.connect(serverTransport);
        try {
            await mcpClient.connect(clientTransport);
            const listed = await mcpClient.listTools();
            const toolNames = listed.tools.map((tool) => tool.name);
            assert.ok(toolNames.includes('get_ui_center_by_path'));
            assert.ok(toolNames.includes('trigger_ui_touch_event_by_path'));

            const centerCall = await mcpClient.callTool({
                name: 'get_ui_center_by_path',
                arguments: { ui_path: 'Main.StartBtn', roleId: 1 },
            });
            assert.ok(!centerCall.isError);
            const centerJson = JSON.parse((centerCall.content as Array<{ text: string }>)[0].text);
            assert.strictEqual(centerJson.x, 10);
            assert.strictEqual(centerJson.y, 20);

            const touchCall = await mcpClient.callTool({
                name: 'trigger_ui_touch_event_by_path',
                arguments: { ui_path: 'Main.StartBtn', touch: '左键', clientSlot: 0 },
            });
            assert.ok(!touchCall.isError);

            const invalidTouch = await mcpClient.callTool({
                name: 'trigger_ui_touch_event_by_path',
                arguments: { ui_path: 'Main.StartBtn', touch: '中键' },
            });
            assert.strictEqual(invalidTouch.isError, true);
            assert.strictEqual(calls.length, 2);
        } finally {
            await mcpClient.close();
            await server.close();
        }
    });
});
