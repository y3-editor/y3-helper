import * as assert from 'assert';
import { buildMultiLaunchLuaArgs, getMultiLaunchTimeoutMs } from '../../mcp/multiLaunch';

suite('Multi-player launch timeout', () => {
    test('uses the 120 second floor for one player', () => {
        assert.strictEqual(getMultiLaunchTimeoutMs(1), 120000);
    });

    test('scales with player count', () => {
        assert.strictEqual(getMultiLaunchTimeoutMs(2), 150000);
        assert.strictEqual(getMultiLaunchTimeoutMs(3), 180000);
    });

    test('caps the timeout at 180 seconds', () => {
        assert.strictEqual(getMultiLaunchTimeoutMs(4), 180000);
        assert.strictEqual(getMultiLaunchTimeoutMs(8), 180000);
    });

    test('passes multi-mode lua args without waiting for a debugger', () => {
        const args = buildMultiLaunchLuaArgs([2, 1]);
        assert.deepStrictEqual(args, {
            lua_multi_mode: 'true',
            lua_multi_debug_players: '1#2',
        });
        assert.ok(!('lua_multi_wait_debugger' in args));
    });
});
