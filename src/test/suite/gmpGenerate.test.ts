import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as msgpack from '@msgpack/msgpack';
import * as cp from 'child_process';
import * as vm from 'vm';
import { createRequire } from 'module';
import { generateProjectGmp, SECTION_INDEXES } from '../../tools/gmpGenerate';
import {
    buildUISection,
    compressZstd,
    decompressZstd,
    GmpBuilder,
    GmpParser,
    packSectionDataOldStyle,
    save,
} from '../../tools/y3SaveGmp';
import { writeGeneratedGmp } from '../../tools/gmpWrite';

/** Load the real save watcher with VS Code events and its debounce clock controlled. */
function pluginSaveWatcher(directory: string) {
    type Listener = (uri: { fsPath: string }) => void;
    const created = new Set<Listener>();
    const changed = new Set<Listener>();
    const timers = new Map<number, () => Promise<void>>();
    let timerId = 0;
    let pluginRuns = 0;
    const subscribe = (listeners: Set<Listener>) => (listener: Listener) => {
        listeners.add(listener);
        return { dispose: () => listeners.delete(listener) };
    };
    const watcher = {
        onDidCreate: subscribe(created),
        onDidChange: subscribe(changed),
        dispose() {},
    };
    const vscode = {
        Disposable: class {},
        EventEmitter: class {},
        RelativePattern: class {},
        workspace: { createFileSystemWatcher: () => watcher },
    };
    const filename = require.resolve('../../plugin/plugin');
    const localRequire = createRequire(filename);
    const module = { exports: {} as { PluginManager: { prototype: object } } };
    const load = vm.runInNewContext(`(function(require,module,exports){${fs.readFileSync(filename, 'utf8')}\n})`, {
        __non_webpack_require__: undefined,
        setTimeout: (callback: () => Promise<void>) => {
            const id = ++timerId;
            timers.set(id, callback);
            return id;
        },
        clearTimeout: (id: number) => timers.delete(id),
    });
    load((name: string) => {
        if (name === 'vscode') { return vscode; }
        if (name === 'y3-helper') { return {}; }
        if (name === '@vscode/l10n') { return {}; }
        return localRequire(name);
    }, module, module.exports);
    const manager = Object.assign(Object.create(module.exports.PluginManager.prototype), {
        map: { uri: { fsPath: directory } },
        _disposables: [] as { dispose(): void }[],
        runAll: async () => {
            pluginRuns++;
            fs.writeFileSync(path.join(directory, 'onSave-ran.lua'), '-- saved by plugin');
        },
    });
    manager.createMapSaveWatcher();
    return {
        created: (file: string) => created.forEach(listener => listener({ fsPath: file })),
        changed: (file: string) => changed.forEach(listener => listener({ fsPath: file })),
        get pluginRuns() { return pluginRuns; },
        async flush() {
            const callbacks = [...timers.values()];
            timers.clear();
            for (const callback of callbacks) { await callback(); }
        },
        dispose() { manager._disposables.forEach((d: { dispose(): void }) => d.dispose()); },
    };
}

suite('Offline GMP generation', function() {
    this.timeout(30000);
    let directory: string;

    setup(function() {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'y3-gmp-test-'));
    });

    teardown(function() {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    async function generateFromAnotherProcess() {
        const builder = new GmpBuilder();
        builder.setHeader(Buffer.alloc(16), 5, '', '');
        builder.setSection(21, await packSectionDataOldStyle({ rule: { '408': false } }), true);
        const gmp = path.join(directory, '1.gmp');
        fs.writeFileSync(gmp, builder.build());
        fs.writeFileSync(path.join(directory, 'ruledata.json'), JSON.stringify({ rule: { '408': true } }));
        const context = path.join(directory, 'context.json');
        fs.writeFileSync(context, JSON.stringify({
            projectPath: directory, entryMapName: 'Entry',
            maps: [{ name: 'Entry', path: directory, id: '1' }],
            useMainLevelTriggerAndObject: false, useMainLevelUI: false,
        }));
        cp.execFileSync(process.execPath, ['-e', `
            const fs = require('fs');
            const { generateProjectGmp } = require(process.argv[1]);
            generateProjectGmp(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')))
                .then(result => { if (!result.success) throw new Error(JSON.stringify(result)); })
                .catch(error => { console.error(error); process.exitCode = 1; });
        `, require.resolve('../../tools/gmpGenerate'), context], {
            windowsHide: true,
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        });
        return gmp;
    }

    test('CLI generation never invokes onSave, including delayed duplicate create/change events', async function() {
        const watcher = pluginSaveWatcher(directory);
        try {
            const gmp = await generateFromAnotherProcess();
            watcher.created(gmp);
            watcher.changed(gmp);
            await watcher.flush();
            watcher.changed(gmp);
            await watcher.flush();
            assert.strictEqual(watcher.pluginRuns, 0);
            assert.strictEqual(fs.existsSync(path.join(directory, 'onSave-ran.lua')), false);
        } finally { watcher.dispose(); }
    });

    test('a later editor save still invokes onSave even with identical GMP content', async function() {
        const watcher = pluginSaveWatcher(directory);
        try {
            const gmp = await generateFromAnotherProcess();
            watcher.changed(gmp);
            await watcher.flush();
            const content = fs.readFileSync(gmp);
            fs.writeFileSync(gmp, content);
            const later = new Date(Date.now() + 5000);
            fs.utimesSync(gmp, later, later);
            watcher.changed(gmp);
            await watcher.flush();
            assert.strictEqual(watcher.pluginRuns, 1);
        } finally { watcher.dispose(); }
    });

    test('offline generation does not suppress saves to another GMP in the same map', async function() {
        const watcher = pluginSaveWatcher(directory);
        try {
            const gmp = await generateFromAnotherProcess();
            const editorGmp = path.join(directory, '1trigger.gmp');
            fs.writeFileSync(editorGmp, 'editor trigger data');
            watcher.changed(gmp);
            watcher.created(editorGmp);
            watcher.changed(editorGmp);
            await watcher.flush();
            assert.strictEqual(watcher.pluginRuns, 1);
        } finally { watcher.dispose(); }
    });

    test('the legacy single-map save also skips onSave plugins', async function() {
        const watcher = pluginSaveWatcher(directory);
        try {
            const builder = new GmpBuilder();
            builder.setHeader(Buffer.alloc(16), 5, '', '');
            builder.setSection(49, await packSectionDataOldStyle({ '1': 'before' }), true);
            const gmp = path.join(directory, '1.gmp');
            fs.writeFileSync(gmp, builder.build());
            fs.writeFileSync(path.join(directory, 'uslanguage.json'), JSON.stringify({ '1': 'after' }));
            const result = await save(directory, {
                updatePrefabs: false, updateUI: false,
                updateUSLanguage: true, updateZHLanguage: false,
            });
            assert.strictEqual(result.success, true);
            watcher.created(gmp);
            watcher.changed(gmp);
            await watcher.flush();
            assert.strictEqual(watcher.pluginRuns, 0);
        } finally { watcher.dispose(); }
    });

    test('a failed replacement preserves the previous write origin and cleans temporary files', async function() {
        if (process.platform !== 'win32') { this.skip(); }
        const watcher = pluginSaveWatcher(directory);
        try {
            const gmp = await generateFromAnotherProcess();
            const original = fs.readFileSync(gmp);
            fs.chmodSync(gmp, 0o444);
            try {
                assert.throws(() => writeGeneratedGmp(gmp, Buffer.from('must not replace a read-only GMP')));
            } finally { fs.chmodSync(gmp, 0o666); }
            assert.deepStrictEqual(fs.readFileSync(gmp), original);
            assert.deepStrictEqual(fs.readdirSync(directory).filter(name => name.endsWith('.tmp')), []);
            watcher.changed(gmp);
            await watcher.flush();
            assert.strictEqual(watcher.pluginRuns, 0);
        } finally { watcher.dispose(); }
    });

    test('old sections retain integer map keys at every nesting level', async function() {
        const body = await packSectionDataOldStyle({
            '123': { '-7': 'value', named: { '0': true } },
            '70000000000000': 70000000000000,
            '9007199254740993': 'large integer key',
        });
        const decoded = msgpack.decode(await decompressZstd(body), {
            useBigInt64: true,
            mapKeyConverter: (key) => `${typeof key}:${String(key)}`,
        });
        assert.deepStrictEqual(decoded, {
            'number:123': {
                'number:-7': 'value',
                'string:named': { 'number:0': true },
            },
            'bigint:70000000000000': 70000000000000n,
            'bigint:9007199254740993': 'large integer key',
        });
    });

    test('UI panel keys identify panels without entering the panel payload', async function() {
        const prefabs = path.join(directory, 'ui', 'prefab');
        fs.mkdirSync(prefabs, { recursive: true });
        fs.writeFileSync(path.join(prefabs, 'panel.json'), JSON.stringify({
            key: 'panel-id', name: 'Inventory', children: [],
        }));
        const body = await buildUISection(directory);
        const decoded = msgpack.decode(await decompressZstd(body));
        assert.deepStrictEqual(decoded, {
            ui_data: [],
            prefab_data: { 'panel-id': { name: 'Inventory', children: [] } },
        });
    });

    test('large terrain sections survive compression and decompression', async function() {
        // MainCity terrain is about 6 MB; Simple WASM needs two full vectors
        // and cannot fit them alongside its stack in the fixed 16 MB heap.
        const terrain = Buffer.alloc(6 * 1024 * 1024, 0x37);
        const compressed = await compressZstd(terrain);
        assert.deepStrictEqual(await decompressZstd(compressed), terrain);
    });

    test('attribute mappings and fixed point positions retain their nested tuples', async function() {
        const builder = new GmpBuilder();
        builder.setHeader(Buffer.alloc(16), 5, '', '');
        const empty = await packSectionDataOldStyle({});
        builder.setSection(67, empty, true);
        builder.setSection(80, empty, true);
        fs.writeFileSync(path.join(directory, '1.gmp'), builder.build());
        fs.writeFileSync(path.join(directory, 'attr.json'), JSON.stringify({
            p: [{ __tuple__: true, items: ['strength', { m: [['hp_max', 1]] }] }],
        }));
        fs.writeFileSync(path.join(directory, 'destructible.json'), JSON.stringify({
            destructible: { '1': { components: { movement: {
                position: { __tuple__: true, items: [[8, 210452480], [0, 0], [-78, 779550720]] },
            } } } },
        }));
        const result = await generateProjectGmp({
            projectPath: directory,
            entryMapName: 'Entry',
            maps: [{ name: 'Entry', path: directory, id: '1' }],
            useMainLevelTriggerAndObject: false,
            useMainLevelUI: false,
        }, { dryRun: true, captureOutput: true });
        assert.strictEqual(result.success, true);
        const file = path.join(directory, 'output.gmp');
        fs.writeFileSync(file, Buffer.from(result.maps[0].outputBase64!, 'base64'));
        const parser = new GmpParser();
        assert.ok(parser.parse(file));
        const attrs = msgpack.decode(await decompressZstd(parser.sections.get(67)!.body)) as {
            p: Array<[string, { m: unknown[][] }]>;
        };
        const entities = msgpack.decode(await decompressZstd(parser.sections.get(80)!.body)) as {
            destructible: Record<string, { components: { movement: { position: unknown[][] } } }>;
        };
        const tupleMarker = Buffer.from([0x11]);
        assert.deepStrictEqual(attrs.p[0][1].m[0], ['hp_max', 1, tupleMarker]);
        assert.deepStrictEqual(entities.destructible['1'].components.movement.position[0], [8, 210452480, tupleMarker]);
    });

    test('a section build error leaves the entire existing GMP untouched', async function() {
        const builder = new GmpBuilder();
        builder.setHeader(Buffer.alloc(16), 5, '', '');
        builder.setSection(SECTION_INDEXES.get('desc')!, Buffer.from('original description'), false);
        builder.setSection(21, await packSectionDataOldStyle({ rule: { '408': false } }), true);
        const original = builder.build();
        const gmpFile = path.join(directory, '1.gmp');
        fs.writeFileSync(gmpFile, original);
        fs.writeFileSync(path.join(directory, 'desc.json'), '{invalid json');
        fs.writeFileSync(path.join(directory, 'ruledata.json'), JSON.stringify({ rule: { '408': true } }));

        const result = await generateProjectGmp({
            projectPath: directory,
            entryMapName: 'Entry',
            maps: [{ name: 'Entry', path: directory, id: '1' }],
            useMainLevelTriggerAndObject: false,
            useMainLevelUI: false,
        });

        assert.strictEqual(result.success, false);
        assert.ok(result.maps[0].errors.some((error) => error.startsWith('desc:')));
        assert.deepStrictEqual(fs.readFileSync(gmpFile), original);
        assert.strictEqual(fs.existsSync(gmpFile + '.bak'), false);
        assert.strictEqual(fs.existsSync(gmpFile + '.tmp'), false);
    });
});
