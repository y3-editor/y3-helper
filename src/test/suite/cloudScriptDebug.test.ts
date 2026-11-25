import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    allocatePort,
    cloudScriptDebugDir,
    createCloudScriptDebugConfiguration,
    readCloudScriptDebugPort,
    resolveLuaDebuggerPath,
    writeCloudScriptDebugFiles,
} from '../../cloudScriptDebug';

suite('Cloud script debug files', () => {
    let directory: string;

    setup(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'y3-cloud-debug-'));
    });

    teardown(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    test('writes and reads the debugger path and port', async () => {
        await writeCloudScriptDebugFiles(directory, 'C:/ext/actboy168.lua-debug-2.4.0-win32-x64', 23456);
        const dir = cloudScriptDebugDir(directory);
        assert.strictEqual(
            fs.readFileSync(path.join(dir, 'debugger_path.lua'), 'utf8'),
            'return [[C:/ext/actboy168.lua-debug-2.4.0-win32-x64]]\n',
        );
        assert.strictEqual(fs.readFileSync(path.join(dir, 'debugger_port.lua'), 'utf8'), 'return 23456\n');
        assert.strictEqual(await readCloudScriptDebugPort(directory), 23456);
    });

    test('escapes path brackets so the Lua string stays valid', async () => {
        await writeCloudScriptDebugFiles(directory, 'C:/odd/]]dir', 1234);
        const text = fs.readFileSync(path.join(cloudScriptDebugDir(directory), 'debugger_path.lua'), 'utf8');
        assert.strictEqual(text, 'return [=[C:/odd/]]dir]=]\n');
    });

    test('missing port file means no manual attach target', async () => {
        assert.strictEqual(await readCloudScriptDebugPort(directory), undefined);
    });

    test('allocates distinct free ports', async () => {
        const ports = new Set(await Promise.all([allocatePort(), allocatePort(), allocatePort()]));
        assert.strictEqual(ports.size, 3);
        for (const port of ports) {
            assert.ok(port > 0 && port < 65536);
        }
    });

    test('applies the given port to the DAP configuration', () => {
        const configuration = createCloudScriptDebugConfiguration('C:\\maps\\demo', 23456, 'attempt');
        assert.strictEqual(configuration.address, '127.0.0.1:23456');
        assert.strictEqual(configuration.y3HelperCloudAttempt, 'attempt');
        assert.deepStrictEqual(configuration.sourceMaps, [['./*', 'C:/maps/demo/cloud_script/*']]);
        assert.ok(!('inject' in configuration));
        assert.ok(!('processId' in configuration));
    });

    test('finds the newest installed lua debugger', async function () {
        this.timeout(10000);
        const found = await resolveLuaDebuggerPath();
        if (!found) { this.skip(); return; }
        assert.ok(found.includes('actboy168.lua-debug-'));
        assert.ok(fs.existsSync(path.join(found, 'script', 'debugger.lua')));
    });
});
