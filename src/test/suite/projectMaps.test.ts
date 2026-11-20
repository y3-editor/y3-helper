import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vm from 'vm';
import { createRequire } from 'module';
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
        assert.deepStrictEqual(Array.from(result.maps, m => m.name), ['Entry']);
        assert.ok(api.messages.some(message => message.includes('Project_Map4')));
        assert.strictEqual(fs.existsSync(path.join(leftover, 'script', '.log')), false);
        assert.strictEqual(fs.existsSync(path.join(directory, 'global_script')), false);
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
});
