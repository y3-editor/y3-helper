import * as assert from 'assert';
import {
	debugAddressForPlayer,
	planMissingMultiDebugPlayers,
	type DebugSessionLike,
} from '../../debugPlayerSessions';

function sessionAt(address: string): DebugSessionLike {
	return { configuration: { address } };
}

suite('Debug player sessions', () => {
	test('plans an attach only for the configured player whose session is missing', () => {
		const plan = planMissingMultiDebugPlayers(
			[1, 2],
			[sessionAt(debugAddressForPlayer(2))],
		);

		assert.deepStrictEqual(plan.missingPlayerIds, [1]);
		assert.strictEqual(plan.consumeWaitMarker, true);
	});

	test('keeps the wait marker while every configured player still appears active', () => {
		const plan = planMissingMultiDebugPlayers(
			[1, 2],
			[sessionAt(debugAddressForPlayer(1)), sessionAt(debugAddressForPlayer(2))],
		);

		assert.deepStrictEqual(plan.missingPlayerIds, []);
		assert.strictEqual(plan.consumeWaitMarker, false);
	});

	test('plans all configured players when no matching session is active', () => {
		const plan = planMissingMultiDebugPlayers([1, 2], []);

		assert.deepStrictEqual(plan.missingPlayerIds, [1, 2]);
		assert.strictEqual(plan.consumeWaitMarker, true);
	});

	test('ignores unrelated debug addresses and de-duplicates configured players', () => {
		const plan = planMissingMultiDebugPlayers(
			[2, 1, 2],
			[sessionAt('127.0.0.1:12000'), sessionAt(debugAddressForPlayer(2))],
		);

		assert.deepStrictEqual(plan.missingPlayerIds, [1]);
	});

	test('consumes a marker when no multi-debug player is configured', () => {
		const plan = planMissingMultiDebugPlayers([], []);

		assert.deepStrictEqual(plan.missingPlayerIds, []);
		assert.strictEqual(plan.consumeWaitMarker, true);
	});
});
