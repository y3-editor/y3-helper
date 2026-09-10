import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as vm from 'vm';
import * as net from 'net';
import { cloudScriptPipe } from '../../cloudScriptDebug';

// Exercise the real coordinator with a controlled VS Code/DAP host. Lua and the
// native debugger protocol are separately exercised by cloudScriptDebug.test.
suite('Cloud script coordinator', function() {
    this.timeout(10000);
    let directory: string;
    let api: typeof import('../../cloudScript');
    let config: { multiMode: boolean };
    let subscriptions: { dispose(): void }[];
    let tracker: { onDidSendMessage(message: object): void };
    let started: Promise<void>;
    let configurations: Record<string, unknown>[];
    let warnings: string[];
    let dirty: boolean;
    let currentProject: { fsPath: string } | undefined;
    let dynamicProvider: { provideDebugConfigurations(folder?: { uri: { fsPath: string } }): Promise<Record<string, unknown>[]> };
    let providerDisposed: boolean;
    let setDocumentText: (text: string) => void;
    let environmentListeners: Set<(session: unknown) => void>;
    const originalEntry = '-- user code\nreturn 42\n';

    setup(async function() {
        if (process.platform !== 'win32') { this.skip(); }
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'y3-cloud-coordinator-'));
        await fs.mkdir(path.join(directory, 'cloud_script'));
        await fs.mkdir(path.join(directory, 'script'));
        await fs.writeFile(path.join(directory, 'script/debugger.lua'), '-- fixture');
        const entry = path.join(directory, 'cloud_script/main.lua');
        await fs.writeFile(entry, originalEntry);
        config = { multiMode: false };
        currentProject = { fsPath: directory };
        providerDisposed = false;
        subscriptions = [];
        configurations = [];
        warnings = [];
        dirty = false;
        let factory: { createDebugAdapterTracker(session: unknown): typeof tracker };
        let onStart!: () => void;
        started = new Promise((resolve) => { onStart = resolve; });
        const startListeners = new Set<(session: unknown) => void>();
        const stopListeners = new Set<(session: unknown) => void>();
        environmentListeners = new Set();
        const event = (listeners: Set<(session: unknown) => void>) => (callback: (session: unknown) => void) => {
            listeners.add(callback);
            return { dispose: () => listeners.delete(callback) };
        };
        const document = {
            uri: { fsPath: entry },
            get isDirty() { return dirty; },
            text: originalEntry,
            getText() { return this.text; },
            positionAt(offset: number) { return offset; },
            async save() { await fs.writeFile(entry, this.text); return true; },
        };
        setDocumentText = (text) => { document.text = text; };
        const vscode = {
            DebugConfigurationProviderTriggerKind: { Dynamic: 2 },
            extensions: { getExtension: () => ({ extensionPath: directory, activate: async () => undefined }) },
            Uri: { file: (fsPath: string) => ({ fsPath }) },
            Range: class {},
            WorkspaceEdit: class {
                text = '';
                replace(_uri: unknown, _range: unknown, text: string) { this.text = text; }
            },
            workspace: {
                textDocuments: [document], workspaceFolders: [{ uri: { fsPath: directory } }],
                getWorkspaceFolder: () => undefined,
                openTextDocument: async () => document,
                applyEdit: async (edit: { text: string }) => { document.text = edit.text; return true; },
            },
            window: {
                showWarningMessage: async (message: string) => { warnings.push(message); return '继续运行'; },
                showErrorMessage: async (message: string) => { warnings.push(message); },
                showInformationMessage: async (message: string) => { warnings.push(message); },
            },
            debug: {
                registerDebugConfigurationProvider: (type: string, provider: typeof dynamicProvider, trigger: number) => {
                    assert.strictEqual(type, 'lua');
                    assert.strictEqual(trigger, 2);
                    dynamicProvider = provider;
                    return { dispose() { providerDisposed = true; } };
                },
                onDidStartDebugSession: event(startListeners),
                onDidTerminateDebugSession: event(stopListeners),
                registerDebugAdapterTrackerFactory: (_type: string, value: typeof factory) => {
                    factory = value;
                    return { dispose() {} };
                },
                startDebugging: async (_folder: unknown, configuration: Record<string, unknown>) => {
                    configurations.push(configuration);
                    const session = { configuration };
                    tracker = factory.createDebugAdapterTracker(session);
                    startListeners.forEach((callback) => callback(session));
                    onStart();
                    return true;
                },
                stopDebugging: async (session: unknown) => { stopListeners.forEach((callback) => callback(session)); },
            },
        };
        const module = { exports: {} };
        const filename = require.resolve('../../cloudScript');
        const load = vm.runInNewContext(`(function(require,module,exports){${await fs.readFile(filename, 'utf8')}\n})`, {
            process, clearTimeout, AbortController,
            setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms === 30000 ? 50 : ms),
        });
        load((name: string) => {
            if (name === 'vscode') { return vscode; }
            if (name === './env') { return { env: { get projectUri() { return currentProject; }, onDidChange: event(environmentListeners) } }; }
            if (name === './config') { return { config }; }
            if (name === './cloudScriptDebug') { return require('../../cloudScriptDebug'); }
            // The coordinator's availability probe must not bind the live game port.
            if (name === 'net') {
                return { createServer: () => {
                    const server = net.createServer();
                    const listen = server.listen.bind(server);
                    server.listen = ((_port: number, host: string, callback: () => void) => listen(0, host, callback)) as typeof server.listen;
                    return server;
                } };
            }
            return require(name);
        }, module, module.exports);
        api = module.exports as typeof api;
        api.init({
            subscriptions,
            asAbsolutePath: (file: string) => path.resolve(__dirname, '../../..', file),
        } as never);
        await api.prepare();
    });

    teardown(async () => {
        subscriptions?.forEach((subscription) => subscription.dispose());
        if (directory) { await fs.rm(directory, { recursive: true, force: true }); }
    });

    function signalDebuggerReady() {
        const socket = net.connect(cloudScriptPipe(directory));
        const result = new Promise<string>((resolve, reject) => {
            let text = '';
            socket.on('data', (chunk) => { text += chunk; });
            socket.on('end', () => { socket.destroy(); resolve(text); });
            socket.on('error', reject);
        });
        return { socket, result };
    }

    test('keeps Lua waiting until configurationDone, then continues', async () => {
        const operation = (await api.beginAutoAttach())!;
        const connection = signalDebuggerReady();
        try {
            await started;
            let completed = false;
            void operation.completion.then(() => { completed = true; });
            await new Promise((resolve) => setTimeout(resolve, 20));
            assert.strictEqual(completed, false, 'session creation must not release Lua');
            assert.strictEqual(configurations[0].address, '127.0.0.1:12306');
            tracker.onDidSendMessage({ type: 'response', command: 'configurationDone', success: true });
            assert.strictEqual(await operation.completion, true);
            assert.match(await connection.result, /continue\n$/);
        } finally { operation.cancel(); connection.socket.destroy(); }
    });

    test('failed attach offers continue and releases Lua', async () => {
        const operation = (await api.beginAutoAttach())!;
        const connection = signalDebuggerReady();
        try {
            await started;
            tracker.onDidSendMessage({ type: 'response', command: 'attach', success: false });
            assert.strictEqual(await operation.completion, false);
            assert.strictEqual(warnings.length, 1);
            assert.match(await connection.result, /continue\n$/);
        } finally { operation.cancel(); connection.socket.destroy(); }
    });

    test('cancel before debugger readiness completes without waiting for timeout', async () => {
        const operation = (await api.beginAutoAttach())!;
        operation.cancel();
        assert.strictEqual(await operation.completion, false);
        assert.strictEqual(configurations.length, 0);
    });

    test('missing debugger readiness times out and offers continue without starting a session', async () => {
        const operation = (await api.beginAutoAttach())!;
        assert.strictEqual(await operation.completion, false);
        assert.strictEqual(configurations.length, 0);
        assert.match(warnings[0], /main\.lua/);
    });

    test('does not save unrelated unsaved business edits when the entry is current', async () => {
        const entry = path.join(directory, 'cloud_script/main.lua');
        const disk = await fs.readFile(entry, 'utf8');
        setDocumentText(disk + '\n-- unsaved business edit');
        dirty = true;
        assert.strictEqual(await api.prepare(), true);
        assert.strictEqual(await fs.readFile(entry, 'utf8'), disk);
    });

    test('refuses to overwrite an unsaved document when its bootstrap needs updating', async () => {
        const entry = path.join(directory, 'cloud_script/main.lua');
        await fs.writeFile(entry, originalEntry);
        setDocumentText(originalEntry + '-- unsaved business edit');
        dirty = true;
        await assert.rejects(api.prepare(), /请先保存/);
        assert.strictEqual(await fs.readFile(entry, 'utf8'), originalEntry);
    });

    test('releases the environment listener on disposal', () => {
        assert.strictEqual(environmentListeners.size, 1);
        subscriptions.forEach((subscription) => subscription.dispose());
        assert.strictEqual(environmentListeners.size, 0);
    });

    test('dynamic configuration supplies the current project without creating launch.json', async () => {
        const choices = await dynamicProvider.provideDebugConfigurations();
        assert.strictEqual(choices.length, 1);
        assert.strictEqual(choices[0].name, '附加本地云脚本');
        assert.strictEqual(choices[0].type, 'lua');
        assert.strictEqual(choices[0].request, 'attach');
        assert.strictEqual(choices[0].address, '127.0.0.1:12306');
        assert.ok(!('y3HelperCloudAttempt' in choices[0]));
        assert.strictEqual(JSON.stringify(choices[0].sourceMaps), JSON.stringify([['./*', directory.replace(/\\/g, '/') + '/cloud_script/*']]));
        await assert.rejects(fs.access(path.join(directory, '.vscode/launch.json')));
        assert.strictEqual(configurations.length, 0);
    });

    test('listing dynamic configurations preserves user launch.json and refreshes the project mapping', async () => {
        const launch = path.join(directory, '.vscode/launch.json');
        await fs.mkdir(path.dirname(launch));
        const custom = '{ // user settings\n"configurations":[{"name":"Mine","address":"127.0.0.1:4567","stopOnEntry":true}]}';
        await fs.writeFile(launch, custom);
        await dynamicProvider.provideDebugConfigurations();
        assert.strictEqual(await fs.readFile(launch, 'utf8'), custom);
        const alternate = path.join(directory, 'alternate');
        await fs.mkdir(path.join(alternate, 'cloud_script'), { recursive: true });
        await fs.writeFile(path.join(alternate, 'cloud_script/main.lua'), '');
        currentProject = { fsPath: alternate };
        const choices = await dynamicProvider.provideDebugConfigurations();
        assert.strictEqual(JSON.stringify(choices[0].sourceMaps), JSON.stringify([['./*', alternate.replace(/\\/g, '/') + '/cloud_script/*']]));
    });

    test('does not offer a cloud configuration for missing projects or unrelated folders', async () => {
        assert.strictEqual((await dynamicProvider.provideDebugConfigurations({ uri: { fsPath: 'unrelated' } })).length, 0);
        currentProject = undefined;
        assert.strictEqual((await dynamicProvider.provideDebugConfigurations()).length, 0);
        currentProject = { fsPath: path.join(directory, 'missing') };
        assert.strictEqual((await dynamicProvider.provideDebugConfigurations()).length, 0);
    });

    test('disposes the dynamic configuration provider', () => {
        assert.strictEqual(providerDisposed, false);
        subscriptions.forEach((subscription) => subscription.dispose());
        assert.strictEqual(providerDisposed, true);
    });

    test('multi-player mode never starts a cloud debug session', async () => {
        config.multiMode = true;
        assert.strictEqual(await api.beginAutoAttach(), undefined);
        assert.strictEqual((await dynamicProvider.provideDebugConfigurations()).length, 0);
        assert.strictEqual(configurations.length, 0);
    });
});
