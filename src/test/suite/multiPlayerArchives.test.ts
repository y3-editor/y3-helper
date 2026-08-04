import * as assert from 'assert';
import {
    applyLocalArchiveAssignments,
    getDefaultLocalArchiveNickname,
    getLocalArchiveAssignments,
    parseEditorNickname,
    parseLocalArchiveData,
    resolveLocalArchiveAssignments,
    serializeLocalArchiveData,
} from '../../multiPlayerArchives';

suite('Multi-player local archives', () => {
    test('reads the logged-in editor nickname', () => {
        assert.strictEqual(parseEditorNickname('{"nickname":" BAIM "}'), 'BAIM');
        assert.strictEqual(parseEditorNickname('{"nickname":""}'), undefined);
        assert.strictEqual(parseEditorNickname('{}'), undefined);
    });

    test('matches editor default nickname assignment', () => {
        assert.strictEqual(getDefaultLocalArchiveNickname([], {}, 'BAIM'), 'BAIM');
        assert.strictEqual(getDefaultLocalArchiveNickname([], {}, undefined), 'test_account1');
        assert.strictEqual(getDefaultLocalArchiveNickname(
            [1, 2],
            {1: 'BAIM', 2: 'test_account1'},
            'BAIM',
        ), 'test_account2');
        assert.strictEqual(getDefaultLocalArchiveNickname(
            [1],
            {1: 'BAIM', 3: 'test_account1'},
            'BAIM',
        ), 'test_account1');
    });

    test('reads existing nickname assignments', () => {
        const data = parseLocalArchiveData(JSON.stringify({
            BAIM: {role_id: 1, archive: {'100': {data_type: 0, data_value: 8}}},
            test_account1: {role_id: -1, archive: {}},
        }));

        assert.deepStrictEqual(getLocalArchiveAssignments(data), [
            {roleId: 1, nickname: 'BAIM'},
        ]);
    });

    test('rebinds selected nicknames and preserves archive payloads', () => {
        const data = parseLocalArchiveData(JSON.stringify({
            BAIM: {role_id: 1, archive: {'100': {data_type: 0, data_value: 8}}},
            test_account1: {role_id: 2, archive: {}, platform_prop: {level: 3}},
            unused: {role_id: 3, archive: {'200': {data_type: 1, data_value: true}}},
        }));

        const updated = applyLocalArchiveAssignments(data, [
            {roleId: 1, nickname: 'test_account1'},
            {roleId: 2, nickname: 'BAIM'},
        ]);

        assert.strictEqual(updated.test_account1.role_id, 1);
        assert.deepStrictEqual(updated.test_account1.platform_prop, {level: 3});
        assert.strictEqual(updated.BAIM.role_id, 2);
        assert.deepStrictEqual(updated.BAIM.archive, {'100': {data_type: 0, data_value: 8}});
        assert.strictEqual(updated.unused.role_id, -3);
    });

    test('creates a blank archive for a new nickname', () => {
        const updated = applyLocalArchiveAssignments(parseLocalArchiveData('{}'), [
            {roleId: 3, nickname: 'new_player'},
        ]);

        assert.deepStrictEqual(updated.new_player, {role_id: 3, archive: {}});
    });

    test('resolves explicit nicknames before persisted role bindings', () => {
        const data = parseLocalArchiveData(JSON.stringify({
            old_name: {role_id: 1, archive: {}},
            player_two: {role_id: 2, archive: {}},
        }));
        assert.deepStrictEqual(resolveLocalArchiveAssignments(
            [1, 2, 3],
            {1: 'new_name'},
            data,
        ), {
            assignments: [
                {roleId: 1, nickname: 'new_name'},
                {roleId: 2, nickname: 'player_two'},
                {roleId: 3, nickname: ''},
            ],
            missingRoleIds: [3],
        });
    });

    test('repairs stale archive bindings but rejects ambiguous launch assignments', () => {
        const stale = parseLocalArchiveData(JSON.stringify({
            one: {role_id: 1},
            two: {role_id: 1},
        }));
        assert.deepStrictEqual(getLocalArchiveAssignments(stale), [
            {roleId: 1, nickname: 'two'},
        ]);
        assert.strictEqual(applyLocalArchiveAssignments(stale, [
            {roleId: 1, nickname: 'one'},
        ]).two.role_id, -2);
        assert.throws(() => applyLocalArchiveAssignments(parseLocalArchiveData('{}'), [
            {roleId: 1, nickname: 'same'},
            {roleId: 2, nickname: 'same'},
        ]), /Duplicate/);
    });

    test('serializes valid JSON with stable nickname ordering', () => {
        const data = parseLocalArchiveData(JSON.stringify({
            zed: {role_id: 2, archive: {}},
            alpha: {role_id: 1, archive: {}},
        }));
        const serialized = serializeLocalArchiveData(data);

        assert.ok(serialized.indexOf('"alpha"') < serialized.indexOf('"zed"'));
        assert.deepStrictEqual(JSON.parse(serialized), JSON.parse(JSON.stringify(data)));
    });
});
