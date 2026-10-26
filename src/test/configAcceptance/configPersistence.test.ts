import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ConfigSnapshot } from '../../configSnapshot';
import type { Y3HelperTestApi } from '../../extension';

const phase = process.env.Y3_CONFIG_TEST_PHASE;
const stateFile = process.env.Y3_CONFIG_TEST_STATE;
const extensionId = 'sumneko.y3-helper';

type ExpectedConfig = Omit<ConfigSnapshot, 'version'> & { cloudScriptAvailable: boolean };

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getApi(): Promise<Y3HelperTestApi> {
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension, `extension ${extensionId} not found`);
    const api = await extension.activate() as Y3HelperTestApi | undefined;
    assert.ok(api?.config, 'test API is not exposed');
    await api.env.mapReady();
    const deadline = Date.now() + 30_000;
    while (!api.env.project?.selectedMap && Date.now() < deadline) {
        await sleep(100);
    }
    assert.ok(api.env.project, 'project was not loaded');
    assert.ok(api.env.project?.selectedMap, `project map was not loaded: ${
        JSON.stringify({
            maps: api.env.project?.maps.map((map) => map.name),
            entryMap: api.env.project?.entryMap?.name,
            selectedMap: api.env.project?.selectedMap?.name,
            currentMap: api.env.currentMap?.name,
            launchMap: api.config.launchMap,
        })
    }`);
    return api;
}

function readExpected(): ExpectedConfig {
    assert.ok(stateFile, 'Y3_CONFIG_TEST_STATE is required');
    return JSON.parse(fs.readFileSync(stateFile, 'utf8')) as ExpectedConfig;
}

(phase ? suite : suite.skip)('Config persistence', () => {
    test(`phase ${phase}`, async () => {
        const api = await getApi();
        if (phase === '1') {
            await runPhase1(api);
        } else if (phase === '2') {
            await runPhase2(api);
        } else {
            assert.fail(`unknown phase ${phase}`);
        }
    });
});

async function runPhase1(api: Y3HelperTestApi) {
    assert.strictEqual(api.config.multiMode, false);
    assert.strictEqual(api.config.tracy, false);
    assert.strictEqual(api.config.attachWhenLaunch, true);
    assert.strictEqual(api.config.attachCloudScriptWhenLaunch, false);
    assert.deepStrictEqual(api.config.multiPlayers, []);
    assert.deepStrictEqual(api.config.launchMap, ['option', 'entry']);

    const project = api.env.project!;
    assert.ok(project.maps.length > 0, 'project has no maps');
    const mapName = project.maps[0].name;
    const roleId = project.multiPlayerRoles[0]?.id;
    assert.ok(roleId, 'project has no selectable roles');
    const selected = [roleId];
    const debug = [roleId];
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const cloudScriptAvailable = !!workspaceFolder
        && fs.existsSync(path.join(workspaceFolder, 'cloud_script', 'main.lua'));

    api.config.update((config) => {
        config.multiMode = true;
        config.tracy = true;
        config.attachWhenLaunch = false;
        config.attachCloudScriptWhenLaunch = true;
        config.multiPlayers = [...selected];
        config.debugPlayers = [...debug];
        config.launchMap = ['map', mapName];
    });
    await api.config.flush();

    const expected: ExpectedConfig = {
        multiMode: true,
        multiPlayers: selected,
        debugPlayers: debug,
        tracy: true,
        attachWhenLaunch: false,
        attachCloudScriptWhenLaunch: true,
        launchMap: ['map', mapName],
        cloudScriptAvailable,
    };
    assert.ok(stateFile, 'Y3_CONFIG_TEST_STATE is required');
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(expected, null, 2));

    const raw = await api.readPersistedConfig() as ConfigSnapshot | undefined;
    assert.ok(raw, 'phase 1 did not persist a config snapshot');
    assert.strictEqual(raw.version, 1);
    assert.deepStrictEqual(raw.multiPlayers, selected);
    assert.deepStrictEqual(raw.debugPlayers, debug);
    assert.deepStrictEqual(raw.launchMap, ['map', mapName]);
    assert.ok(!('multiPlayerNicknames' in raw));
}

async function runPhase2(api: Y3HelperTestApi) {
    const expected = readExpected();
    const rawBefore = await api.readPersistedConfig() as ConfigSnapshot | undefined;
    assert.ok(rawBefore, 'phase 2 did not load a persisted config snapshot');

    assert.strictEqual(api.config.multiMode, expected.multiMode);
    assert.strictEqual(api.config.tracy, expected.tracy);
    assert.strictEqual(api.config.attachWhenLaunch, expected.attachWhenLaunch);
    assert.deepStrictEqual(api.config.multiPlayers, expected.multiPlayers);
    assert.deepStrictEqual(api.config.debugPlayers, expected.debugPlayers);
    assert.deepStrictEqual(api.config.launchMap, expected.launchMap);
    assert.strictEqual(api.env.project?.selectedMap?.name, expected.launchMap[1]);

    assert.strictEqual(api.config.attachCloudScriptWhenLaunch, expected.cloudScriptAvailable);
    assert.strictEqual(rawBefore.attachCloudScriptWhenLaunch, true);

    await sleep(500);
    assert.deepStrictEqual(await api.readPersistedConfig(), rawBefore);
}
