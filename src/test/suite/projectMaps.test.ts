import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vm from 'vm';
import { createRequire } from 'module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GmpBuilder, packSectionDataOldStyle } from '../../tools/y3SaveGmp';

suite('GMP project map discovery', function() {
    this.timeout(30000);
    let directory: string;

    setup(function() {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'y3-project-maps-'));
        fs.mkdirSync(path.join(directory, 'maps'));
        writeProject('1');
    });

    teardown(function() {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    function writeProject(id: string, name = 'Entry') {
        fs.writeFileSync(path.join(directory, 'header.project'), `{"entry_map":{"id":${id},"name":${JSON.stringify(name)}}}`);
    }

    async function map(name = 'Entry', id = '1', displayName = name) {
        const mapPath = path.join(directory, 'maps', name);
        fs.mkdirSync(mapPath, { recursive: true });
        fs.writeFileSync(path.join(mapPath, 'header.map'), `{"id":${id}}`);
        fs.writeFileSync(path.join(mapPath, 'desc.json'), JSON.stringify({ name: displayName }));
        const builder = new GmpBuilder();
        builder.setHeader(Buffer.alloc(16), 5, '', '');
        builder.setSection(21, await packSectionDataOldStyle({ rule: { '408': false } }), true);
        const gmp = path.join(mapPath, id + '.gmp');
        fs.writeFileSync(gmp, builder.build());
        return { name, path: mapPath, id, gmp };
    }

    function adapter(cached = [{ name: 'Entry', id: 1n, uri: { fsPath: path.join(directory, 'maps', 'Entry') } }]) {
        const filename = require.resolve('../../tools/gmpProject');
        const localRequire = createRequire(filename);
        const messages: string[] = [];
        const module = { exports: {} as typeof import('../../tools/gmpProject') };
        const load = vm.runInNewContext(`(function(require,module,exports){${fs.readFileSync(filename, 'utf8')}\n})`, {});
        load((name: string) => {
            if (name === '../env') {
                return { env: { projectUri: { fsPath: directory }, project: {
                    maps: cached, entryMap: cached[0], setting: {},
                } } };
            }
            if (name === './log') {
                return { log: { info: (message: string) => messages.push(message), warn: (message: string) => messages.push(message) } };
            }
            return localRequire(name);
        }, module, module.exports);
        return { ...module.exports, messages };
    }

    test('project initialization never constructs plugin managers for non-level directories', async function() {
        const entry = await map();
        fs.mkdirSync(path.join(directory, 'maps', 'Project_Map4', 'script'), { recursive: true });
        fs.writeFileSync(path.join(directory, 'maps', 'notes.txt'), 'not a level');
        const constructed: string[] = [];
        const createdDirectories: string[] = [];
        class Uri {
            constructor(public fsPath: string) {}
            static joinPath(base: Uri, ...parts: string[]) { return new Uri(path.join(base.fsPath, ...parts)); }
        }
        class Disposable {
            constructor(private cleanup?: () => void) {}
            dispose() { this.cleanup?.(); }
        }
        const listener = () => new Disposable();
        const logs = { info() {}, error() {} };
        const testEnv = {};
        const vscode = {
            Disposable, Uri,
            RelativePattern: class {},
            workspace: {
                createFileSystemWatcher: () => ({ onDidChange: listener, onDidCreate: listener, onDidDelete: listener, dispose() {} }),
                fs: { createDirectory: async (uri: Uri) => { createdDirectories.push(uri.fsPath); } },
            },
        };
        const y3 = {
            env: testEnv, log: logs, uri: Uri.joinPath,
            fs: {
                readFile: async (uri: Uri) => {
                    try { return { string: await fs.promises.readFile(uri.fsPath, 'utf8') }; }
                    catch { return undefined; }
                },
                dir: async (uri: Uri, relative: string) => (await fs.promises.readdir(path.join(uri.fsPath, relative))).map(name => [name, 2]),
            },
        };
        const filename = require.resolve('../../env');
        const localRequire = createRequire(filename);
        const source = fs.readFileSync(filename, 'utf8');
        assert.ok(source.includes('exports.env = new Env();'));
        const module = { exports: {} as { TestProject: new (uri: Uri) => { start(): Promise<void>; maps: { name: string }[]; dispose(): void } } };
        const load = vm.runInNewContext(`(function(require,module,exports){${source.replace('exports.env = new Env();', 'exports.env = testEnv;')}\nexports.TestProject = Project;\n})`, { testEnv });
        load((name: string) => {
            if (name === 'vscode') { return vscode; }
            if (name === 'y3-helper') { return y3; }
            if (name === './tools') { return { log: logs }; }
            if (name === '@vscode/l10n') { return { t: (text: string) => text }; }
            if (name === './config') { return { config: { attachCloudScriptWhenLaunch: false } }; }
            if (name === './editorTable/language') {
                return { Language: class { onDidChange() {} async start() {} } };
            }
            if (name === './editorTable/editorTable') { return { EditorManager: class {} }; }
            if (name === './plugin/plugin') {
                return { PluginManager: class extends Disposable {
                    constructor(map: { name: string }) { super(); constructed.push(map.name); }
                } };
            }
            return localRequire(name);
        }, module, module.exports);
        const project = new module.exports.TestProject(new Uri(directory));
        try {
            await project.start();
            assert.deepStrictEqual(Array.from(project.maps, m => m.name), ['Entry']);
            assert.deepStrictEqual(constructed, ['Entry']);
            assert.deepStrictEqual(createdDirectories, [path.join(entry.path, 'script', '.log')]);
        } finally { project.dispose(); }
    });

    test('ignores Project_Map4 leftovers and ordinary files instead of treating them as levels', async function() {
        const entry = await map();
        await map('Cave', '2');
        const leftover = path.join(directory, 'maps', 'Project_Map4');
        fs.mkdirSync(path.join(leftover, 'script'), { recursive: true });
        fs.writeFileSync(path.join(directory, 'maps', 'notes.txt'), 'not a level');
        const api = adapter([
            { name: entry.name, id: 1n, uri: { fsPath: entry.path } },
            { name: 'Project_Map4', id: 0n, uri: { fsPath: leftover } },
            { name: 'notes.txt', id: 0n, uri: { fsPath: path.join(directory, 'maps', 'notes.txt') } },
        ]);
        const result = await api.generateAllGmp({ dryRun: true });
        assert.strictEqual(result.success, true);
        assert.deepStrictEqual(Array.from(result.maps, m => m.name).sort(), ['Cave', 'Entry']);
        assert.ok(api.messages.some(message => message.includes('Project_Map4')));
        assert.strictEqual(fs.existsSync(path.join(leftover, 'script', '.log')), false);
        assert.strictEqual(fs.existsSync(path.join(directory, 'global_script')), false);
    });

    test('MCP uses the same full-project scope as the sidebar and rejects a retired selector', async function() {
        const entry = await map();
        const cave = await map('Cave', '2');
        for (const m of [entry, cave]) {
            fs.writeFileSync(path.join(m.path, 'ruledata.json'), JSON.stringify({ rule: { '408': true } }));
        }
        const api = adapter();
        const filename = require.resolve('../../mcp/tcpServer');
        const localRequire = createRequire(filename);
        const module = { exports: {} as { TCPServer: { prototype: { createMcpServer(): McpServer } } } };
        const load = vm.runInNewContext(`(function(require,module,exports){${fs.readFileSync(filename, 'utf8')}\n})`, {});
        let calls = 0;
        load((name: string) => {
            if (name === 'vscode') return { Disposable: class {} };
            if (name === '../tools/gmpProject') {
                return { generateAllGmp: (options: { dryRun?: boolean }) => { calls++; return api.generateAllGmp(options); } };
            }
            if (['../tools', './gameSessionManager', '../customDefine', '../env'].includes(name)) return {};
            return localRequire(name);
        }, module, module.exports);
        const server = Object.create(module.exports.TCPServer.prototype).createMcpServer() as McpServer;
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        const client = new Client({ name: 'gmp-test', version: '1' });
        await server.connect(serverTransport);
        try {
            await client.connect(clientTransport);
            const dryRun = await client.callTool({ name: 'generate_gmp', arguments: { dryRun: true } });
            assert.ok(!dryRun.isError);
            const text = (dryRun.content as { text: string }[])[0].text;
            const preview = JSON.parse(text);
            assert.strictEqual(preview.dryRun, true);
            assert.deepStrictEqual(preview.maps.map((m: { name: string }) => m.name).sort(), ['Cave', 'Entry']);
            assert.ok([entry, cave].every(m => !fs.existsSync(m.gmp + '.bak')));
            const rejected = await client.callTool({ name: 'generate_gmp', arguments: { mapNames: ['Entry'] } });
            assert.strictEqual(rejected.isError, true);
            assert.strictEqual(calls, 1);
            const sideBarResult = await api.generateAllGmp();
            assert.deepStrictEqual(sideBarResult.maps.map(m => m.name).sort(), preview.maps.map((m: { name: string }) => m.name).sort());
            assert.ok([entry, cave].every(m => fs.existsSync(m.gmp + '.bak')));
        } finally {
            await client.close();
            await server.close();
        }
    });
    test('rediscovers a renamed entry level by ID instead of its cached path or header display name', async function() {
        const entry = await map('Project_Map4');
        writeProject('1', 'Project_Map4');
        const api = adapter([{ name: entry.name, id: 1n, uri: { fsPath: entry.path } }]);
        fs.renameSync(entry.path, path.join(directory, 'maps', 'Renamed'));
        const result = await api.generateAllGmp({ dryRun: true });
        assert.strictEqual(result.success, true);
        assert.deepStrictEqual(Array.from(result.maps, m => m.name), ['Renamed']);
        assert.strictEqual(result.maps[0].gmpFile, path.join(directory, 'maps', 'Renamed', '1.gmp'));
    });

    test('does not use an old GMP or trigger.gmp when the matching ID package is missing', async function() {
        const entry = await map();
        fs.renameSync(entry.gmp, path.join(entry.path, '999.gmp'));
        fs.copyFileSync(path.join(entry.path, '999.gmp'), path.join(entry.path, '1trigger.gmp'));
        const result = await adapter().generateAllGmp({ dryRun: true });
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.maps[0].gmpFile, entry.gmp);
        assert.ok(result.maps[0].errors.some(error => error.includes(entry.gmp)));
    });

    test('reports a corrupt header.map before writing any otherwise valid level', async function() {
        const entry = await map();
        const original = fs.readFileSync(entry.gmp);
        fs.writeFileSync(path.join(entry.path, 'ruledata.json'), JSON.stringify({ rule: { '408': true } }));
        const broken = path.join(directory, 'maps', 'Broken');
        fs.mkdirSync(broken);
        const header = path.join(broken, 'header.map');
        fs.writeFileSync(header, '{"id":');
        const result = await adapter([
            { name: entry.name, id: 1n, uri: { fsPath: entry.path } },
            { name: 'Broken', id: 0n, uri: { fsPath: broken } },
        ]).generateAllGmp();
        assert.strictEqual(result.success, false);
        assert.ok(result.message?.includes(header));
        assert.deepStrictEqual(fs.readFileSync(entry.gmp), original);
        assert.strictEqual(fs.existsSync(entry.gmp + '.bak'), false);
    });

    test('exposes the level display name and exact missing package path', async function() {
        const entry = await map('Entry', '1', '第四关');
        fs.unlinkSync(entry.gmp);
        const result = await adapter().generateAllGmp({ dryRun: true });
        assert.strictEqual(result.success, false);
        assert.strictEqual((result.maps[0] as { displayName?: string }).displayName, '第四关');
        assert.ok(result.maps[0].errors.some(error => error.includes(entry.gmp)));
        assert.strictEqual((result as { projectPath?: string }).projectPath, directory);
    });

    test('reads exact large IDs and current sharing settings rather than cached metadata', async function() {
        const id = '155472871267073737411193777670325161395';
        await map('Entry', id);
        writeProject(id, 'OutdatedName');
        fs.writeFileSync(path.join(directory, 'setting.json'), JSON.stringify({
            use_main_level_trigger_and_object: true, use_main_level_ui: true,
        }));
        const context = await adapter().getGmpProjectContext();
        assert.strictEqual(context?.maps[0].id, id);
        assert.strictEqual(context?.entryMapName, 'Entry');
        assert.strictEqual(context?.useMainLevelTriggerAndObject, true);
        assert.strictEqual(context?.useMainLevelUI, true);
    });

    test('fails explicitly when header.project points at a missing entry level', async function() {
        await map();
        writeProject('2', 'Missing');
        const result = await adapter().generateAllGmp({ dryRun: true });
        assert.strictEqual(result.success, false);
        assert.ok(result.message?.includes('入口'));
        assert.ok(result.message?.includes(path.join(directory, 'header.project')));
    });

    test('rejects duplicate level IDs instead of silently choosing the first directory', async function() {
        await map();
        await map('Duplicate', '1');
        const result = await adapter().generateAllGmp({ dryRun: true });
        assert.strictEqual(result.success, false);
        assert.ok(result.message?.includes('ID'));
        assert.ok(result.message?.includes('Entry') && result.message?.includes('Duplicate'));
    });

    test('an existing header with a zero or non-integer ID is an error rather than an ignored directory', async function() {
        const entry = await map();
        const header = path.join(entry.path, 'header.map');
        for (const invalid of ['0', '-1', '1.5', 'true']) {
            fs.writeFileSync(header, `{"id":${invalid}}`);
            const result = await adapter().generateAllGmp({ dryRun: true });
            assert.strictEqual(result.success, false);
            assert.ok(result.message?.includes(header));
            assert.ok(result.message?.includes('ID'));
        }
    });

    test('sidebar generateGmp command requires modal confirmation before rebuilding', async function() {
        const commands = new Map<string, () => Promise<void>>();
        const warningPrompts: Array<{ message: string; options: { modal?: boolean; detail?: string }; items: string[] }> = [];
        const infoMessages: string[] = [];
        const errorMessages: string[] = [];
        let nextWarningChoice: string | undefined;
        let progressCalls = 0;
        let generateCalls = 0;
        let hasProject = false;

        const vscodeStub = {
            ProgressLocation: { Notification: 15 },
            commands: {
                registerCommand: (id: string, handler: () => Promise<void>) => {
                    commands.set(id, handler);
                    return { dispose() {} };
                },
            },
            window: {
                showWarningMessage: async (message: string, options: { modal?: boolean; detail?: string }, ...items: string[]) => {
                    warningPrompts.push({ message, options, items });
                    return nextWarningChoice;
                },
                showInformationMessage: (message: string) => {
                    infoMessages.push(message);
                },
                showErrorMessage: (message: string) => {
                    errorMessages.push(message);
                },
                withProgress: async (_options: unknown, task: () => Promise<void>) => {
                    progressCalls++;
                    await task();
                },
            },
        };

        const filename = require.resolve('../../extension');
        const source = fs.readFileSync(filename, 'utf8');
        const module = { exports: {} as { TestHelper: { prototype: { registerCommandOfGenerateGmp(): void } } } };
        const load = vm.runInNewContext(
            `(function(require,module,exports,__dirname){${source}\nexports.TestHelper = Helper;\n})`,
            {},
        );
        load((name: string) => {
            if (name === 'module-alias') { return { addAliases() {} }; }
            if (name === 'vscode') { return vscodeStub; }
            if (name === '@vscode/l10n') {
                return {
                    t: (text: string, ...args: string[]) =>
                        text.replace(/\{(\d+)\}/g, (_m, i) => args[Number(i)] ?? ''),
                };
            }
            if (name === './env') {
                return {
                    env: {
                        mapReady: async () => {},
                        get project() { return hasProject ? {} : undefined; },
                        get projectUri() { return hasProject ? { fsPath: directory } : undefined; },
                    },
                };
            }
            if (name === './tools/gmpProject') {
                return {
                    generateAllGmp: async () => {
                        generateCalls++;
                        return {
                            success: true,
                            dryRun: false,
                            projectPath: directory,
                            maps: [{ name: 'Entry', gmpFile: path.join(directory, '1.gmp'), changed: true, replacedSections: [], preservedSections: [], errors: [] }],
                        };
                    },
                };
            }
            return {};
        }, module, module.exports, path.dirname(filename));

        const helper = Object.create(module.exports.TestHelper.prototype) as { registerCommandOfGenerateGmp(): void };
        helper.registerCommandOfGenerateGmp();
        const runGenerateGmp = commands.get('y3-helper.generateGmp');
        assert.ok(runGenerateGmp);

        // No project loaded: show error without popping confirmation dialog.
        await runGenerateGmp!();
        assert.strictEqual(errorMessages.length, 1);
        assert.strictEqual(warningPrompts.length, 0);
        assert.strictEqual(generateCalls, 0);

        // Project loaded, user cancels modal: do not start progress or rebuild.
        hasProject = true;
        nextWarningChoice = undefined;
        await runGenerateGmp!();
        assert.strictEqual(warningPrompts.length, 1);
        assert.strictEqual(warningPrompts[0].options.modal, true);
        assert.ok(warningPrompts[0].options.detail?.includes(directory));
        assert.deepStrictEqual(warningPrompts[0].items, ['确认重建']);
        assert.strictEqual(progressCalls, 0);
        assert.strictEqual(generateCalls, 0);

        // Project loaded, user confirms modal: rebuild runs and reports update.
        nextWarningChoice = '确认重建';
        await runGenerateGmp!();
        assert.strictEqual(warningPrompts.length, 2);
        assert.strictEqual(progressCalls, 1);
        assert.strictEqual(generateCalls, 1);
        assert.deepStrictEqual(infoMessages, ['GMP 已更新：Entry']);
    });
});
