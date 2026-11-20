import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as msgpack from '@msgpack/msgpack';
import * as cp from 'child_process';
import * as vm from 'vm';
import { deflateSync } from 'zlib';
import { createDecipheriv } from 'crypto';
import { createRequire } from 'module';
import { generateProjectGmp, GmpProjectContext, SECTION_INDEXES } from '../../tools/gmpGenerate';
import {
    buildUISection,
    compressZstd,
    decompressZstd,
    GmpBuilder,
    GmpParser,
    packSectionDataOldStyle,
    packSectionDataNewStyle,
    save,
} from '../../tools/y3SaveGmp';
import { writeGeneratedGmp } from '../../tools/gmpWrite';
import { scanGmpProject } from '../../tools/projectMaps';

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
        builder.setSection(93, await compressZstd(Buffer.from('80045d942e', 'hex')));
        fs.writeFileSync(path.join(directory, 'texture.json'), deflateSync(Buffer.from('80049506000000000000005d944be3612e', 'hex')));
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
                .then(result => { if (!result.success || !result.maps[0].replacedSections.includes('texture_data')) throw new Error(JSON.stringify(result)); })
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

    function singleMap(): GmpProjectContext {
        return {
            projectPath: directory, entryMapName: 'Entry',
            maps: [{ name: 'Entry', path: directory, id: '1' }],
            useMainLevelTriggerAndObject: false, useMainLevelUI: false,
        };
    }

    test('texture sections preserve their original encoding until their disk payload changes', async function() {
        const gmpFile = path.join(directory, '1.gmp');
        const textures = Buffer.from('80049506000000000000005d944be3612e', 'hex'); // pickle [227]
        const clearedTextures = Buffer.from('80045d942e', 'hex'); // pickle []
        const painted = Buffer.from('0b0000000300000001000000010203', 'hex'); // one texture chunk with a density blob
        const clearedFoliage = Buffer.alloc(4); // one texture chunk, no vegetation
        const texturePath = path.join(directory, 'texture.json');
        const foliagePath = path.join(directory, 'texturefoliage.json');
        const builder = new GmpBuilder();
        builder.preserveInsertionOrder = true;
        builder.setSection(8, Buffer.from('unchanged resource_data'));
        builder.setSection(93, await compressZstd(textures, 1));
        builder.setSection(105, await compressZstd(painted, 1));
        builder.setSection(116, Buffer.from('unchanged cloud_res_dep_data'));
        const original = builder.build();
        fs.writeFileSync(gmpFile, original);
        fs.writeFileSync(texturePath, deflateSync(textures));
        const first = await generateProjectGmp(singleMap(), { dryRun: true });
        assert.ok(first.success);
        assert.deepStrictEqual(first.maps[0].replacedSections, []);
        assert.ok(first.maps[0].preservedSections.includes('texture_data'));
        assert.ok(first.maps[0].preservedSections.includes('texture_foliage_data'));
        assert.strictEqual(first.maps[0].changed, false);

        fs.writeFileSync(texturePath, deflateSync(clearedTextures));
        fs.writeFileSync(foliagePath, deflateSync(clearedFoliage));
        const dryRun = await generateProjectGmp(singleMap(), { dryRun: true, captureOutput: true });
        assert.ok(dryRun.success);
        assert.deepStrictEqual(dryRun.maps[0].replacedSections, ['texture_data', 'texture_foliage_data']);
        assert.deepStrictEqual(fs.readFileSync(gmpFile), original);
        assert.ok(!fs.existsSync(gmpFile + '.bak'));
        const written = await generateProjectGmp(singleMap());
        assert.ok(written.success);
        assert.deepStrictEqual(fs.readFileSync(gmpFile + '.bak'), original);
        assert.deepStrictEqual(fs.readFileSync(gmpFile), Buffer.from(dryRun.maps[0].outputBase64!, 'base64'));
        const parser = new GmpParser();
        assert.ok(parser.parse(gmpFile));
        assert.deepStrictEqual(await decompressZstd(parser.sections.get(93)!.body), clearedTextures);
        assert.deepStrictEqual(await decompressZstd(parser.sections.get(105)!.body), clearedFoliage);
        assert.deepStrictEqual(parser.sections.get(8)!.body, Buffer.from('unchanged resource_data'));
        assert.deepStrictEqual(parser.sections.get(116)!.body, Buffer.from('unchanged cloud_res_dep_data'));
        assert.strictEqual((await generateProjectGmp(singleMap())).maps[0].changed, false);
        fs.writeFileSync(texturePath, deflateSync(textures));
        fs.writeFileSync(foliagePath, deflateSync(painted));
        const refilled = await generateProjectGmp(singleMap());
        assert.ok(refilled.success && refilled.maps[0].changed);
        assert.ok(parser.parse(gmpFile));
        assert.deepStrictEqual(await decompressZstd(parser.sections.get(93)!.body), textures);
        assert.deepStrictEqual(await decompressZstd(parser.sections.get(105)!.body), painted);
        assert.deepStrictEqual(fs.readFileSync(gmpFile + '.bak'), original);
    });

    test('a damaged texture file prevents all changes to that level and preserves its backup', async function() {
        const gmpFile = path.join(directory, '1.gmp');
        const source = path.join(directory, 'texturefoliage.json');
        const builder = new GmpBuilder();
        builder.setSection(93, await compressZstd(Buffer.from('80045d942e', 'hex')));
        builder.setSection(105, await compressZstd(Buffer.alloc(4)));
        const original = builder.build();
        const backup = Buffer.from('previous backup');
        fs.writeFileSync(gmpFile, original);
        fs.writeFileSync(gmpFile + '.bak', backup);
        fs.writeFileSync(path.join(directory, 'texture.json'), deflateSync(Buffer.from('80049506000000000000005d944be3612e', 'hex')));
        // A missing file, an empty compressed stream, and a damaged block are different cases.
        for (const broken of [Buffer.alloc(0), deflateSync(Buffer.from([1, 0, 0, 0]))]) {
            fs.writeFileSync(source, broken);
            const result = await generateProjectGmp(singleMap());
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.maps[0].name, 'Entry');
            assert.ok(result.maps[0].errors.some(error => error.startsWith('texture_foliage_data:') && error.includes(source)));
            assert.deepStrictEqual(fs.readFileSync(gmpFile), original);
            assert.deepStrictEqual(fs.readFileSync(gmpFile + '.bak'), backup);
        }
    });
    test('scene sections retain integer keys, tuples, floats and binary through edits and instance deletion', async function() {
        // Independent reference encodings of {"instances": {1: {"rid": 2**58+1,
        // "pos": (1,2.0,-3), "tag": b"\0\xff", "list": [True,False]}}}.
        const source = '80049559000000000000007d948c09696e7374616e636573947d944b017d94288c03726964948a0801000000000000048c03706f73944b014740000000000000004afdffffff87948c0374616794430200ff948c046c697374945d94288889657573732e';
        const originalPayload = Buffer.from('81a9696e7374616e636573810184a3726964cf0400000000000001a3706f739401cb4000000000000000fdc40111a3746167c40200ffa46c69737492c3c2', 'hex');
        const gmp = path.join(directory, '1.gmp');
        const builder = new GmpBuilder();
        builder.setSection(4, await compressZstd(originalPayload, 1));
        builder.setSection(114, await compressZstd(originalPayload, 1));
        const original = builder.build();
        fs.writeFileSync(gmp, original);
        const dec = path.join(directory, 'decorationdata.data');
        const objects = path.join(directory, 'resourceobjectdata.data');
        fs.writeFileSync(dec, deflateSync(Buffer.from(source, 'hex')));
        fs.writeFileSync(objects, deflateSync(Buffer.from(source, 'hex')));
        assert.strictEqual((await generateProjectGmp(singleMap())).maps[0].changed, false);
        assert.deepStrictEqual(fs.readFileSync(gmp), original);

        const edit = source.replace('0100000000000004', '0200000000000004');
        const newPayload = Buffer.from(originalPayload.toString('hex').replace('0400000000000001', '0400000000000002'), 'hex');
        const removed = Buffer.from('80049512000000000000007d948c09696e7374616e636573947d94732e', 'hex');
        const emptyPayload = Buffer.from('81a9696e7374616e63657380', 'hex');
        const parser = new GmpParser();
        for (const [editFile, removeFile, editId, removeId] of [[dec, objects, 4, 114], [objects, dec, 114, 4]] as const) {
            fs.writeFileSync(editFile, deflateSync(Buffer.from(edit, 'hex')));
            fs.writeFileSync(removeFile, deflateSync(removed));
            const result = await generateProjectGmp(singleMap());
            assert.ok(result.success, result.maps[0].errors.join('\n'));
            assert.ok(parser.parse(gmp));
            assert.deepStrictEqual(await decompressZstd(parser.sections.get(editId)!.body), newPayload);
            assert.deepStrictEqual(await decompressZstd(parser.sections.get(removeId)!.body), emptyPayload);
        }
        assert.deepStrictEqual(fs.readFileSync(gmp + '.bak'), original);
        const stable = fs.readFileSync(gmp);
        fs.writeFileSync(objects, deflateSync(Buffer.from([0x80, 4, 0x63]))); // GLOBAL is never evaluated
        const failure = await generateProjectGmp(singleMap());
        assert.ok(!failure.success && failure.maps[0].errors.some(e => e.includes(objects) && e.includes('0x63')));
        assert.deepStrictEqual(fs.readFileSync(gmp), stable);
        assert.deepStrictEqual(fs.readFileSync(gmp + '.bak'), original);
    });
    async function baseWithTable(directory: string, encrypted = false, hasTable = true): Promise<string> {
        const builder = new GmpBuilder();
        builder.preserveInsertionOrder = true;
        builder.setSection(SECTION_INDEXES.get('desc')!, await packSectionDataNewStyle({
            encrypt_sections: encrypted ? ['table_data'] : [],
        }));
        if (hasTable) {
            builder.setSection(96, encrypted
                ? Buffer.from('GoKuYQ84BJ81QkJhfo9YzA==') // AES-CBC + Base64 of a compressed empty msgpack map
                : await compressZstd(Buffer.from([0x80])));
        }
        const file = path.join(directory, '1.gmp');
        fs.writeFileSync(file, builder.build());
        return file;
    }

    async function readTable(file: string, encrypted = false): Promise<any> {
        const parser = new GmpParser();
        assert.ok(parser.parse(file));
        let bytes = parser.sections.get(96)!.body;
        if (encrypted) {
            const key = Buffer.from('2bd99bd3623021ca59d997a973edd9cf', 'hex');
            const decipher = createDecipheriv('aes-128-cbc', key, key);
            bytes = Buffer.concat([decipher.update(bytes.toString('ascii'), 'base64'), decipher.final()]);
        }
        return msgpack.decode(await decompressZstd(bytes));
    }

    test('runtime JSON tables use the effective level, merge init tables, and read back encrypted', async function() {
        const extra = path.join(directory, 'Extra');
        const init = path.join(directory, 'archive', 'init_tables');
        for (const dir of [init, path.join(directory, 'tables'), path.join(extra, 'tables')]) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const entryGmp = await baseWithTable(directory, true);
        const extraGmp = await baseWithTable(extra, true);
        const project = singleMap();
        project.maps.push({ name: 'Extra', path: extra, id: '1' });
        for (const [map, value, keyType] of [[directory, 10, 'str'], [extra, 20, 'int']] as const) {
            fs.writeFileSync(path.join(map, 'tables', 'Shared.json'), JSON.stringify({ table_type: 1, table_data: {
                kv_key_type: keyType,
                data: [['key', 'type', 'value', 'desc'], ['001', 'int', value], ['v', 'vector3', '(1, 2.0, 3)']],
            } }));
        }
        fs.writeFileSync(path.join(init, 'Starter.json'), JSON.stringify({ table_type: 0, table_data: {
            key: [0, 1], data: [['id', 'part', 'active'], ['int', 'string', 'bool'], ['008', '001', ''], ['009', '', true]],
        } }));
        project.useMainLevelTriggerAndObject = true;
        const run = await generateProjectGmp(project);
        assert.ok(run.success, JSON.stringify(run.maps.map(m => m.errors)));
        const table = await readTable(entryGmp, true);
        assert.deepStrictEqual(await readTable(extraGmp, true), table);
        assert.strictEqual(table.Shared[1]['001'], 10);
        assert.deepStrictEqual(table.Shared[1].v, [1, 2, 3, Buffer.from([0x11])]);
        assert.deepStrictEqual(table['Starter07bb5bc7-deab-429c-a64f-f3d340eb3bdc'], ['data', [
            [['id', 'int', 'key1', Buffer.from([0x11])], ['part', 'string', 'key2', Buffer.from([0x11])],
                ['active', 'bool', null, Buffer.from([0x11])]], [[8, '001', false]], Buffer.from([0x11]),
        ]]);
        const stable = await generateProjectGmp(project, { dryRun: true });
        assert.ok(stable.success && stable.maps.every(m => !m.changed));
        project.useMainLevelTriggerAndObject = false;
        const individual = await generateProjectGmp(project);
        assert.ok(individual.success);
        assert.deepStrictEqual(individual.maps.filter(m => m.replacedSections.includes('table_data')).map(m => m.name), ['Extra']);
        const extraData = (await readTable(extraGmp, true)).Shared[1];
        assert.strictEqual(extraData['1'], 20);
        assert.ok(!Object.hasOwn(extraData, '001'));
    });

    test('only JSON files participate in runtime table generation', async function() {
        const tables = path.join(directory, 'tables');
        const init = path.join(directory, 'archive', 'init_tables');
        for (const folder of [tables, init]) {
            fs.mkdirSync(folder, { recursive: true });
            fs.writeFileSync(path.join(folder, 'kv_probe.csv'), 'Key,Type,Value,Desc\nprobe,int,99,\n');
            for (const ext of ['xlsx', 'xlsm', 'xls', 'table_editor']) {
                fs.writeFileSync(path.join(folder, `kv_probe.${ext}`), 'not a table');
            }
        }
        const gmp = await baseWithTable(directory);
        const original = fs.readFileSync(gmp);
        const missing = await generateProjectGmp(singleMap());
        assert.ok(missing.success && !missing.maps[0].changed, JSON.stringify(missing.maps[0].errors));
        assert.deepStrictEqual(fs.readFileSync(gmp), original);
        assert.ok(!fs.existsSync(gmp + '.bak'));

        fs.writeFileSync(path.join(tables, 'kv_probe.JSON'), JSON.stringify({ table_type: 1, table_data: {
            data: [['Key', 'Type', 'Value', 'Desc'], ['probe', 'int', 7]],
        } }));
        const result = await generateProjectGmp(singleMap());
        assert.ok(result.success, result.maps[0].errors.join('\n'));
        assert.deepStrictEqual(await readTable(gmp), { kv_probe: ['global', { probe: 7 }] });
    });

    test('invalid or conflicting JSON tables report their source without rewriting the package', async function() {
        const tables = path.join(directory, 'tables');
        const nested = path.join(tables, 'nested');
        fs.mkdirSync(nested, { recursive: true });
        const gmp = await baseWithTable(directory);
        const original = fs.readFileSync(gmp);
        const json = JSON.stringify({ table_type: 1, table_data: {
            data: [['Key', 'Type', 'Value', 'Desc'], ['key', 'int', 3]],
        } });
        fs.writeFileSync(path.join(tables, 'kv_probe.json'), json);
        for (const [file, message, content] of [
            [path.join(tables, 'malformed.json'), 'table_data', '{"table_type":1}'],
            [path.join(tables, 'bad_header.json'), '缺少 Key / Type / Value 表头', '{"table_type":1,"table_data":{"data":[]}}'],
            [path.join(nested, 'kv_probe.json'), '同名表格', json],
        ]) {
            fs.writeFileSync(file, content);
            const result = await generateProjectGmp(singleMap());
            assert.ok(!result.success);
            assert.ok(result.maps[0].errors.some(error => error.includes(file) && error.includes(message)), result.maps[0].errors.join('\n'));
            assert.deepStrictEqual(fs.readFileSync(gmp), original);
            assert.ok(!fs.existsSync(gmp + '.bak'));
            fs.unlinkSync(file);
        }
    });
    test('adds the first encrypted table at the editor position for the verified project mode', async function() {
        const mapPath = path.join(directory, 'maps', 'Entry');
        fs.mkdirSync(path.join(mapPath, 'tables'), { recursive: true });
        fs.writeFileSync(path.join(directory, 'header.project'), JSON.stringify({
            entry_map: { id: 1 }, major_version_number: '2.0', phy_mode: '2.5d',
        }));
        fs.writeFileSync(path.join(mapPath, 'header.map'), '{"id":1}');
        fs.writeFileSync(path.join(mapPath, 'tables', 'ignored.xlsx'), 'not a table');
        fs.writeFileSync(path.join(mapPath, 'tables', 'kv_gmp_probe.json'), JSON.stringify({ table_type: 1, table_data: {
            kv_key_type: 'str', data: [['Key', 'Type', 'Value', 'Des'], ['probe', 'int', 2718]],
        } }));
        const gmp = path.join(mapPath, '1.gmp');
        const builder = new GmpBuilder();
        builder.preserveInsertionOrder = true;
        builder.setHeader(Buffer.alloc(16), 73, '202611201424', '');
        const desc = SECTION_INDEXES.get('desc')!;
        builder.setSection(desc, await packSectionDataNewStyle({ encrypt_sections: ['table_data'] }));
        builder.setSection(8, Buffer.from('keep exact resources'));
        builder.setSection(99, await packSectionDataOldStyle({ value: 99 }));
        builder.setSection(101, await packSectionDataOldStyle({ value: 101 }));
        const base = builder.build();
        fs.writeFileSync(gmp, base);
        const { context } = await scanGmpProject(directory);
        assert.ok(context);
        const dry = await generateProjectGmp(context, { dryRun: true, captureOutput: true });
        assert.ok(dry.success, JSON.stringify(dry.maps[0].errors));
        assert.deepStrictEqual(dry.maps[0].addedSections, ['table_data']);
        assert.ok(!dry.maps[0].replacedSections.includes('table_data'));
        assert.deepStrictEqual(fs.readFileSync(gmp), base);
        assert.ok(!fs.existsSync(gmp + '.bak'));
        const write = await generateProjectGmp(context);
        assert.ok(write.success);
        assert.deepStrictEqual(write.maps[0].addedSections, ['table_data']);
        assert.deepStrictEqual(fs.readFileSync(gmp), Buffer.from(dry.maps[0].outputBase64!, 'base64'));
        assert.deepStrictEqual(fs.readFileSync(gmp + '.bak'), base);
        assert.deepStrictEqual(await readTable(gmp, true), { kv_gmp_probe: ['global', { probe: 2718 }] });
        const rebuilt = new GmpParser();
        assert.ok(rebuilt.parse(gmp));
        assert.deepStrictEqual([...rebuilt.sections.keys()], [desc, 8, 99, 96, 101]);
        assert.deepStrictEqual(rebuilt.sections.get(8)!.body, Buffer.from('keep exact resources'));
        const repeat = await generateProjectGmp(context);
        assert.ok(repeat.success && !repeat.maps[0].changed);
    });
    test('omits section 96 only when valid header-only sources explicitly clear a verified table package', async function() {
        const mapPath = path.join(directory, 'maps', 'Entry');
        const tables = path.join(mapPath, 'tables');
        fs.mkdirSync(tables, { recursive: true });
        fs.writeFileSync(path.join(directory, 'header.project'), '{"entry_map":{"id":1},"major_version_number":"2.0","phy_mode":"2.5d"}');
        fs.writeFileSync(path.join(mapPath, 'header.map'), '{"id":1}');
        const builder = new GmpBuilder();
        builder.preserveInsertionOrder = true;
        builder.setHeader(Buffer.alloc(16), 73, '202611201424', '');
        builder.setSection(SECTION_INDEXES.get('desc')!, await packSectionDataNewStyle({ encrypt_sections: ['table_data'] }));
        builder.setSection(8, Buffer.from('resource bytes'));
        // The first-table editor sample for kv_gmp_probe.probe = 2718.
        builder.setSection(96, Buffer.from('QmsE7u8SyBwpQWCh9MR2TZL4JGbvu3lXOGzASs7WgfcxSgnCFws+g13XuZLZpUhE'));
        builder.setSection(116, Buffer.from('cloud resource bytes'));
        const file = path.join(mapPath, '1.gmp');
        const original = builder.build();
        fs.writeFileSync(file, original);
        const { context } = await scanGmpProject(directory);
        assert.ok(context);
        const absent = await generateProjectGmp(context);
        assert.ok(absent.success && !absent.maps[0].changed);
        assert.ok(absent.maps[0].preservedSections.includes('table_data'));

        const source = path.join(tables, 'config_empty.json');
        const writeHeader = (type: string) => fs.writeFileSync(source, JSON.stringify({
            table_type: 0, table_data: { key: [0], data: [['id'], [type]] },
        }));
        writeHeader('');
        const bad = await generateProjectGmp(context);
        assert.ok(!bad.success && bad.maps[0].errors.some(error => error.includes(source) && error.includes('缺少类型')));
        assert.deepStrictEqual(fs.readFileSync(file), original);
        assert.ok(!fs.existsSync(file + '.bak'));

        writeHeader('int');
        const wrongMode = await generateProjectGmp({ ...context, projectFormat: { majorVersion: '2.0', physicsMode: '3d' } });
        assert.ok(!wrongMode.success && !wrongMode.maps[0].removedSections);
        assert.deepStrictEqual(fs.readFileSync(file), original);
        const dry = await generateProjectGmp(context, { dryRun: true, captureOutput: true });
        assert.ok(dry.success, dry.maps[0].errors.join('\n'));
        assert.deepStrictEqual(dry.maps[0].removedSections, ['table_data']);
        assert.deepStrictEqual(fs.readFileSync(file), original);
        assert.ok(!fs.existsSync(file + '.bak'));
        const actual = await generateProjectGmp(context);
        assert.ok(actual.success);
        assert.deepStrictEqual(actual.maps[0].removedSections, ['table_data']);
        assert.deepStrictEqual(fs.readFileSync(file), Buffer.from(dry.maps[0].outputBase64!, 'base64'));
        assert.deepStrictEqual(fs.readFileSync(file + '.bak'), original);
        const parsed = new GmpParser();
        assert.ok(parsed.parse(file));
        assert.ok(!parsed.sections.has(96));
        assert.deepStrictEqual(parsed.sections.get(8)!.body, Buffer.from('resource bytes'));
        assert.deepStrictEqual(parsed.sections.get(116)!.body, Buffer.from('cloud resource bytes'));
        assert.ok(!(await generateProjectGmp(context)).maps[0].changed);
    });
    test('a valid first table is reported but not added to a base whose section presence rule is not verified', async function() {
        const gmp = await baseWithTable(directory, true, false);
        const folder = path.join(directory, 'tables');
        fs.mkdirSync(folder);
        fs.writeFileSync(path.join(folder, 'new.json'), JSON.stringify({ table_type: 1, table_data: {
            data: [['key', 'type', 'value', 'desc'], ['key1', 'int', 3]],
        } }));
        const before = fs.readFileSync(gmp);
        const report = await generateProjectGmp(singleMap());
        assert.ok(report.success && !report.maps[0].changed);
        assert.ok(report.maps[0].sectionNotes?.table_data.includes('仅验证过'));
        assert.deepStrictEqual(fs.readFileSync(gmp), before);
        assert.ok(!fs.existsSync(gmp + '.bak'));
    });
    test('packs project archive defaults rather than stale level copies, and distinguishes clearing from absence', async function() {
        const mapPath = path.join(directory, 'maps', 'Entry');
        const projectArchive = path.join(directory, 'archive');
        fs.mkdirSync(mapPath, { recursive: true });
        fs.mkdirSync(projectArchive);
        fs.writeFileSync(path.join(directory, 'header.project'), '{"entry_map":{"id":1},"major_version_number":"2.0","phy_mode":"2.5d"}');
        fs.writeFileSync(path.join(mapPath, 'header.map'), '{"id":1}');
        const gmp = path.join(mapPath, '1.gmp');
        const builder = new GmpBuilder();
        builder.setHeader(Buffer.alloc(16), 73, '202611201424', '');
        const player = (slots: Record<string, unknown>) => ({
            archive_slots: slots, archive_drop_config: {}, multi_keys_limit_config: {}, open_archive_key: 0,
        });
        const slot = (value: number) => ({ '1': { key: 1, name: 'probe', type: 2, value } });
        const globalConfig = (value: number) => ({ '007': { data_type: 0, default_value: value } });
        builder.setSection(95, await packSectionDataOldStyle(player({})));
        const base = builder.build();
        fs.writeFileSync(gmp, base);
        fs.writeFileSync(path.join(mapPath, 'archive.json'), JSON.stringify(player(slot(11))));
        fs.writeFileSync(path.join(mapPath, 'mapscore.json'), JSON.stringify(globalConfig(22)));
        const projectPlayerPath = path.join(projectArchive, 'archive.json');
        const projectGlobalPath = path.join(projectArchive, 'mapscore.json');
        fs.writeFileSync(projectPlayerPath, JSON.stringify(player(slot(12345))));
        fs.writeFileSync(projectGlobalPath, JSON.stringify(globalConfig(31415)));
        const { context } = await scanGmpProject(directory);
        assert.ok(context);
        const preview = await generateProjectGmp(context, { dryRun: true });
        assert.ok(preview.success);
        assert.deepStrictEqual(preview.maps[0].addedSections, ['global_archive_data']);
        assert.ok(preview.maps[0].replacedSections.includes('archive_data'));
        assert.deepStrictEqual(fs.readFileSync(gmp), base);
        const first = await generateProjectGmp(context);
        assert.ok(first.success, JSON.stringify(first.maps[0].errors));
        const parser = new GmpParser();
        assert.ok(parser.parse(gmp));
        assert.deepStrictEqual(msgpack.decode(await decompressZstd(parser.sections.get(95)!.body)), player(slot(12345)));
        const packedGlobal = parser.sections.get(110)!.body;
        assert.deepStrictEqual(msgpack.decode(await decompressZstd(packedGlobal)), globalConfig(31415));
        assert.deepStrictEqual(fs.readFileSync(gmp + '.bak'), base);
        const stable = await generateProjectGmp(context);
        assert.ok(stable.success && !stable.maps[0].changed);

        fs.unlinkSync(projectGlobalPath);
        const missing = await generateProjectGmp(context);
        assert.ok(missing.success && missing.maps[0].preservedSections.includes('global_archive_data'));
        assert.ok(parser.parse(gmp));
        assert.deepStrictEqual(parser.sections.get(110)!.body, packedGlobal);
        fs.writeFileSync(projectPlayerPath, JSON.stringify(player({})));
        fs.writeFileSync(projectGlobalPath, '{}');
        const cleared = await generateProjectGmp(context);
        assert.ok(cleared.success);
        assert.deepStrictEqual(cleared.maps[0].removedSections, ['global_archive_data']);
        const clearedParser = new GmpParser();
        assert.ok(clearedParser.parse(gmp));
        assert.deepStrictEqual(msgpack.decode(await decompressZstd(clearedParser.sections.get(95)!.body)), player({}));
        assert.ok(!clearedParser.sections.has(110));

        const before = fs.readFileSync(gmp);
        fs.writeFileSync(projectPlayerPath, JSON.stringify(player(slot(999))));
        fs.writeFileSync(projectGlobalPath, '{malformed');
        const failed = await generateProjectGmp(context);
        assert.ok(!failed.success && failed.maps[0].errors.some(e => e.includes('global_archive_data') && e.includes(projectGlobalPath)));
        assert.deepStrictEqual(fs.readFileSync(gmp), before);
        assert.deepStrictEqual(fs.readFileSync(gmp + '.bak'), base);
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
