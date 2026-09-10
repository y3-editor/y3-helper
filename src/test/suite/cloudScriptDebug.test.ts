import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as net from 'net';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { CloudScriptBridge, cloudScriptPipe, createCloudScriptDebugConfiguration, installCloudScriptEntry } from '../../cloudScriptDebug';

const bootstrap = path.resolve(__dirname, '../../..', 'resources/cloudScriptDebugger.lua');
const extensions = path.join(os.homedir(), '.vscode', 'extensions');
const luaDebug = process.env.Y3_LUA_DEBUG_EXTENSION ?? (fs.existsSync(extensions)
    ? fs.readdirSync(extensions).filter((name) => name.startsWith('actboy168.lua-debug-')).sort().reverse()
        .map((name) => path.join(extensions, name))[0] : undefined);
const luaExe = luaDebug && path.join(luaDebug, 'runtime/win32-x64/lua54/lua.exe');

function luaLiteral(value: string) { return `[==[${value.replace(/\\/g, '/')}]==]`; }

function runLua(script: string): { child: ChildProcessWithoutNullStreams; result: Promise<string> } {
    const child = spawn(luaExe!, ['-e', script], { windowsHide: true });
    const result = new Promise<string>((resolve, reject) => {
        let output = '';
        child.stdout.on('data', (data) => { output += data; });
        child.stderr.on('data', (data) => { output += data; });
        child.on('error', reject);
        child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(`Lua exit ${code}: ${output}`)));
    });
    return { child, result };
}

suite('Cloud script entry attachment', () => {
    test('updates only its owned block, preserves BOM/CRLF and is idempotent', () => {
        const source = '\uFEFF-- business\r\nreturn 42\r\n';
        const first = installCloudScriptEntry(source, 'C:\\helper\\bootstrap.lua', 'C:\\debug\\debugger.lua', 'pipe');
        assert.ok(first.startsWith('\uFEFF'));
        assert.ok(first.endsWith(source.slice(1)));
        assert.strictEqual(first, installCloudScriptEntry(first, 'C:\\helper\\bootstrap.lua', 'C:\\debug\\debugger.lua', 'pipe'));
        const next = installCloudScriptEntry(first, 'C:/new/bootstrap.lua', 'C:/debug/debugger.lua', 'pipe');
        assert.strictEqual(next.match(/BEGIN Y3 HELPER LOCAL CLOUD DEBUG/g)?.length, 1);
        assert.ok(next.endsWith(source.slice(1)));
        assert.ok(!next.includes('C:/helper/'));
    });

    test('refuses incomplete owned markers instead of removing business code', () => {
        assert.throws(() => installCloudScriptEntry('-- BEGIN Y3 HELPER LOCAL CLOUD DEBUG\nreturn 42', 'a', 'b', 'c'));
    });

    test('replaces old event and entry-switch blocks without retaining legacy selection', () => {
        for (const mode of ['RegisterEvent("_localmodeloaded", function() end)', 'attach_at_entry = true -- Y3 HELPER ENTRY DEBUG']) {
            const source = '-- BEGIN Y3 HELPER LOCAL CLOUD DEBUG\n' + mode + '\n-- END Y3 HELPER LOCAL CLOUD DEBUG\n\nrequire("business")';
            const updated = installCloudScriptEntry(source, 'bootstrap', 'debugger', 'pipe');
            assert.ok(!updated.includes('_localmodeloaded'));
            assert.ok(!updated.includes('attach_at_entry'));
            assert.ok(updated.endsWith('require("business")'));
            assert.strictEqual(updated, installCloudScriptEntry(updated, 'bootstrap', 'debugger', 'pipe'));
        }
    });

    test('uses a project-specific control pipe and a TCP configuration without injection', () => {
        assert.strictEqual(cloudScriptPipe('C:\\Maps\\Demo'), cloudScriptPipe('c:/maps/demo'));
        assert.notStrictEqual(cloudScriptPipe('c:/a'), cloudScriptPipe('c:/b'));
        const cfg = createCloudScriptDebugConfiguration('C:\\maps\\demo', 'attempt');
        assert.strictEqual(cfg.address, '127.0.0.1:12306');
        assert.ok(!('inject' in cfg));
        assert.ok(!('processId' in cfg));
        assert.deepStrictEqual(cfg.sourceMaps, [['./*', 'C:/maps/demo/cloud_script/*']]);
    });

    test('normal editor connection continues immediately; debug connection waits until released', async () => {
        const bridge = new CloudScriptBridge(cloudScriptPipe(`test-${process.pid}-${Date.now()}`));
        await bridge.listen();
        const receive = () => new Promise<string>((resolve, reject) => {
            const socket = net.connect(bridge.pipe);
            let data = '';
            socket.on('data', (chunk) => { data += chunk; });
            socket.on('end', () => { socket.destroy(); resolve(data); });
            socket.on('error', reject);
        });
        try {
            assert.strictEqual(await receive(), 'continue\n');
            const ready = bridge.beginWait();
            const waiting = receive();
            await ready;
            bridge.release();
            assert.match(await waiting, /^wait\ncontinue\n$/);
        } finally { bridge.dispose(); }
    });
});

suite('Cloud script Lua runtime', function() {
    this.timeout(15000);
    let directory: string;
    let debuggerProxy: string;
    let port: number;
    setup(async function() {
        if (process.platform !== 'win32' || !luaExe || !fs.existsSync(luaExe)) { this.skip(); }
        port = await new Promise<number>((resolve, reject) => {
            const server = net.createServer();
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                const selected = (server.address() as net.AddressInfo).port;
                server.close(() => resolve(selected));
            });
        });
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'y3-cloud-debug-test-'));
        debuggerProxy = path.join(directory, 'debugger.lua');
        // Keep the real bootstrap and debugger, redirect only the test listener.
        fs.writeFileSync(debuggerProxy, `
            local filename = ${luaLiteral(path.join(luaDebug!, 'script/debugger.lua'))}
            local dbg = assert(loadfile(filename))(filename)
            local start = dbg.start
            function dbg:start(config)
                assert(config.address == '127.0.0.1:12306')
                config.address = '127.0.0.1:${port}'
                return start(self, config)
            end
            return dbg
        `);
    });

    teardown(() => {
        if (directory) { fs.rmSync(directory, { recursive: true, force: true }); }
    });

    test('missing any prerequisite silently skips debugger and continues business', async () => {
        const entry = installCloudScriptEntry('business = true', bootstrap, 'unused', 'pipe');
        const { result } = runLua(`
            for _, missing in ipairs({'all', 'loadfile', 'io', 'open', 'os', 'getenv', 'package', 'loadlib'}) do
                local env = { type = type, io = { open = function() end }, os = { getenv = function() end }, package = { loadlib = function() end } }
                env.loadfile = function() error('must not load debugger') end
                if missing == 'all' then env = { type = type }
                elseif missing == 'open' then env.io.open = nil
                elseif missing == 'getenv' then env.os.getenv = nil
                elseif missing == 'loadlib' then env.package.loadlib = nil
                else env[missing] = nil end
                assert(load(${luaLiteral(entry)}, 'entry', 't', env))()
                assert(env.business)
            end
            print('all-restricted-environments-skipped')
        `);
        assert.match(await result, /all-restricted-environments-skipped/);
    });

    test('capable host attaches before require and missing plugin files do not block business', async () => {
        const entry = installCloudScriptEntry('require("business")', 'bootstrap', 'debugger', 'pipe');
        const { result } = runLua(`
            for _, fails in ipairs({false, true}) do
                local attached, warned, ran = false, false, false
                local env = { type = type, pcall = pcall, assert = assert, tostring = tostring, io = io, os = os, package = package }
                env.Log = { warn = function(message) assert(message:find('missing plugin')); warned = true end }
                env.loadfile = function()
                    if fails then return nil, 'missing plugin' end
                    return function() return function() attached = true end end
                end
                env.require = function(name) assert(name == 'business' and (attached or fails)); ran = true end
                assert(load(${luaLiteral(entry)}, 'entry', 't', env))()
                assert(ran and (attached ~= fails) and warned == fails)
            end
            print('entry-and-failure-paths-ok')
        `);
        assert.match(await result, /entry-and-failure-paths-ok/);
    });

    test('actual debugger completes DAP configuration while Lua waits, then releases on continue', async () => {
        const bridge = new CloudScriptBridge(cloudScriptPipe(`dap-${process.pid}-${Date.now()}`));
        await bridge.listen();
        const ready = bridge.beginWait();
        const entry = installCloudScriptEntry("print('released')", bootstrap, debuggerProxy, bridge.pipe);
        const { child, result } = runLua(`assert(load(${`[==[${entry}]==]`}, 'entry'))()`);
        // Attach immediately to prevent an early child error from becoming unhandled.
        void result.catch(() => undefined);
        let socket: net.Socket | undefined;
        try {
            await Promise.race([ready, result.then(() => { throw new Error('Lua exited before ready'); })]);
            await new Promise((resolve) => setTimeout(resolve, 200));
            socket = net.connect(port, '127.0.0.1');
            const connection = socket;
            let seq = 0;
            let buffer = Buffer.alloc(0);
            const pending = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();
            connection.on('data', (chunk: Buffer) => {
                buffer = Buffer.concat([buffer, chunk]);
                while (true) {
                    const headerEnd = buffer.indexOf('\r\n\r\n');
                    if (headerEnd < 0) { break; }
                    const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, headerEnd).toString())![1]);
                    if (buffer.length < headerEnd + 4 + length) { break; }
                    const message = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString());
                    buffer = buffer.subarray(headerEnd + 4 + length);
                    if (message.type === 'response') {
                        const request = pending.get(message.request_seq);
                        pending.delete(message.request_seq);
                        if (message.success) { request?.resolve(); }
                        else { request?.reject(new Error(JSON.stringify(message))); }
                    }
                }
            });
            const request = (command: string, args: object) => new Promise<void>((resolve, reject) => {
                const id = ++seq;
                pending.set(id, { resolve, reject });
                const body = JSON.stringify({ seq: id, type: 'request', command, arguments: args });
                connection.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
            });
            await new Promise<void>((resolve, reject) => { connection.once('connect', resolve); connection.once('error', reject); });
            await request('initialize', { adapterID: 'lua', linesStartAt1: true, columnsStartAt1: true, pathFormat: 'path' });
            await request('attach', { sourceCoding: 'utf8', stopOnEntry: false, outputCapture: [] });
            await request('configurationDone', {});
            bridge.release();
            assert.match(await result, /released/);
        } finally {
            socket?.destroy();
            bridge.dispose();
            child.kill();
        }
    });

    test('closing the Helper pipe releases Lua without attaching a debugger', async () => {
        const bridge = new CloudScriptBridge(cloudScriptPipe(`cancel-${process.pid}-${Date.now()}`));
        await bridge.listen();
        const ready = bridge.beginWait();
        const { child, result } = runLua(`
            assert(loadfile(${luaLiteral(bootstrap)}))()(${luaLiteral(debuggerProxy)}, [==[${bridge.pipe}]==])
            print('cancelled')
        `);
        void result.catch(() => undefined);
        try {
            await Promise.race([ready, result.then(() => { throw new Error('Lua exited before ready'); })]);
            bridge.dispose();
            assert.match(await result, /cancelled/);
        } finally { bridge.dispose(); child.kill(); }
    });
});
