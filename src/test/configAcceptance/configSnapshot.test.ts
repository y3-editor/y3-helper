import * as assert from 'assert';
import {
    CONFIG_VERSION,
    createDefaultConfigSnapshot,
    filterPlayerSelection,
    normalizeLaunchMap,
    parseConfigSnapshot,
    sanitizeConfigForPlatform,
    snapshotConfig,
} from '../../configSnapshot';

suite('Config snapshot', () => {
    test('returns current defaults for missing or malformed data', () => {
        const defaults = createDefaultConfigSnapshot();
        assert.deepStrictEqual(parseConfigSnapshot(undefined), defaults);
        assert.deepStrictEqual(parseConfigSnapshot(null), defaults);
        assert.deepStrictEqual(parseConfigSnapshot('bad'), defaults);
        assert.deepStrictEqual(parseConfigSnapshot([]), defaults);
    });

    test('falls back field by field for wrong types', () => {
        const snapshot = parseConfigSnapshot({
            multiMode: 'yes',
            multiPlayers: [1, '2', -1, 1, 3.5, 4],
            debugPlayers: [1, 4, 8],
            tracy: 1,
            attachWhenLaunch: 'false',
            attachCloudScriptWhenLaunch: null,
            launchMap: ['map', 3],
        });

        assert.strictEqual(snapshot.version, CONFIG_VERSION);
        assert.strictEqual(snapshot.multiMode, false);
        assert.deepStrictEqual(snapshot.multiPlayers, [1, 4]);
        assert.deepStrictEqual(snapshot.debugPlayers, [1, 4]);
        assert.strictEqual(snapshot.tracy, false);
        assert.strictEqual(snapshot.attachWhenLaunch, true);
        assert.strictEqual(snapshot.attachCloudScriptWhenLaunch, false);
        assert.deepStrictEqual(snapshot.launchMap, ['option', 'entry']);
    });

    test('serializes only persisted fields and copies arrays', () => {
        const state = {
            multiMode: true,
            multiPlayers: [1, 2],
            debugPlayers: [2],
            tracy: true,
            attachWhenLaunch: false,
            attachCloudScriptWhenLaunch: true,
            launchMap: ['map', 'main'] as ['map', string],
        };
        const snapshot = snapshotConfig(state);

        assert.deepStrictEqual(snapshot, { version: CONFIG_VERSION, ...state });
        assert.notStrictEqual(snapshot.multiPlayers, state.multiPlayers);
        assert.ok(!('multiPlayerNicknames' in snapshot));
    });

    test('forces cloud-script auto attach off outside Windows', () => {
        const enabled = {
            ...createDefaultConfigSnapshot(),
            attachCloudScriptWhenLaunch: true,
        };
        assert.strictEqual(sanitizeConfigForPlatform(enabled, 'darwin').attachCloudScriptWhenLaunch, false);
        assert.strictEqual(sanitizeConfigForPlatform(enabled, 'win32').attachCloudScriptWhenLaunch, true);
    });

    test('normalizes stale launch maps back to the entry map', () => {
        assert.deepStrictEqual(normalizeLaunchMap(['map', 'gone'], {
            hasCurrent: false,
            mapNames: ['main'],
        }), ['option', 'entry']);
        assert.deepStrictEqual(normalizeLaunchMap(['map', 'main'], {
            hasCurrent: false,
            mapNames: ['main'],
        }), ['map', 'main']);
        assert.deepStrictEqual(normalizeLaunchMap(['option', 'current'], {
            hasCurrent: false,
            mapNames: [],
        }), ['option', 'entry']);
        assert.deepStrictEqual(normalizeLaunchMap(['option', 'entry'], {
            hasCurrent: false,
            mapNames: [],
        }), ['option', 'entry']);
    });

    test('filters invalid and non-selected debug players', () => {
        assert.deepStrictEqual(filterPlayerSelection([1, 2, 9, 2], [2, 3, 9], [1, 2, 3]), {
            multiPlayers: [1, 2],
            debugPlayers: [2],
        });
    });
});
