import * as assert from 'assert';
import {
	createCloudScriptDebugConfiguration,
	selectNewProcessId,
	parseTasklistProcessIds,
	shouldAutoAttachCloudScript,
	selectLatestEntryPointFailure,
	isProcessInjectionFailure,
	waitForNewProcess,
	waitForProcessStability,
	type ProcessSnapshotProvider,
} from '../../cloudScriptProcess';

class SnapshotSequence implements ProcessSnapshotProvider {
	private index = 0;

	constructor(private readonly snapshots: readonly number[][]) {}

	async listMockMlsProcessIds(): Promise<readonly number[]> {
		const snapshot = this.snapshots[Math.min(this.index, this.snapshots.length - 1)];
		this.index += 1;
		return snapshot;
	}
}

suite('Cloud script process discovery', () => {
	test('waits for a stabilization window before accepting a discovered process', async () => {
		let releaseDelay!: () => void;
		let snapshotQueries = 0;
		const provider: ProcessSnapshotProvider = {
			async listMockMlsProcessIds() {
				snapshotQueries += 1;
				return [42];
			},
		};
		const waiting = waitForProcessStability(provider, 42, {
			delayMs: 1000,
			delay: () => new Promise<boolean>((resolve) => {
				releaseDelay = () => resolve(true);
			}),
		});

		await Promise.resolve();
		assert.strictEqual(snapshotQueries, 0);
		releaseDelay();
		assert.deepStrictEqual(await waiting, { kind: 'ready' });
		assert.strictEqual(snapshotQueries, 1);
	});

	test('rejects a discovered process that exits during stabilization', async () => {
		const result = await waitForProcessStability(
			new SnapshotSequence([[]]),
			42,
			{ delayMs: 0 },
		);

		assert.deepStrictEqual(result, { kind: 'exited' });
	});

	test('cancels process stabilization without querying another snapshot', async () => {
		let snapshotQueries = 0;
		const result = await waitForProcessStability({
			async listMockMlsProcessIds() {
				snapshotQueries += 1;
				return [42];
			},
		}, 42, {
			delayMs: 1000,
			delay: async () => false,
		});

		assert.deepStrictEqual(result, { kind: 'cancelled' });
		assert.strictEqual(snapshotQueries, 0);
	});

	test('recognizes process injection failures that require matching privileges', () => {
		assert.strictEqual(isProcessInjectionFailure(new Error(
			'Cannot attach process `2380`. injectdll failed.',
		)), true);
		assert.strictEqual(isProcessInjectionFailure(new Error('tasklist failed')), false);
	});

	test('reports only the newest entry-point failure written during this launch', () => {
		assert.strictEqual(selectLatestEntryPointFailure([
			{ filePath: 'old.log', modifiedAt: 10, content: 'EntryPoint failed' },
			{ filePath: 'newer.log', modifiedAt: 30, content: 'ok' },
			{ filePath: 'failed.log', modifiedAt: 20, content: 'EntryPoint failed' },
		], 15), 'failed.log');
		assert.strictEqual(selectLatestEntryPointFailure([
			{ filePath: 'old.log', modifiedAt: 10, content: 'EntryPoint failed' },
		], 15), undefined);
	});

	test('enables automatic cloud script attachment only for single-player launches', () => {
		assert.strictEqual(shouldAutoAttachCloudScript(true, false), true);
		assert.strictEqual(shouldAutoAttachCloudScript(false, false), false);
		assert.strictEqual(shouldAutoAttachCloudScript(true, true), false);
	});

	test('builds a non-blocking hook attach configuration for the launched PID', () => {
		assert.deepStrictEqual(
			createCloudScriptDebugConfiguration('C:\\maps\\demo', 42, 'Local cloud script'),
			{
				type: 'lua',
				request: 'attach',
				name: 'Local cloud script',
				processId: 42,
				inject: 'hook',
				stopOnEntry: false,
				sourceCoding: 'utf8',
				sourceMaps: [['./*', 'C:\\maps\\demo\\cloud_script\\*']],
				y3HelperDebugKind: 'cloudScript',
			},
		);
	});

	test('parses MockMls PIDs from tasklist CSV output and ignores localized status text', () => {
		const output = [
			'"MockMls.exe","30","Console","1","10,000 K"',
			'信息: 没有运行的任务匹配指定标准。',
			'"MockMls.exe","20","Console","1","10,000 K"',
			'"MockMls.exe","30","Console","1","10,000 K"',
		].join('\r\n');

		assert.deepStrictEqual(parseTasklistProcessIds(output), [20, 30]);
	});

	test('selects the only MockMls process created after the launch snapshot', () => {
		assert.deepStrictEqual(selectNewProcessId([10, 20], [10, 20, 30]), {
			kind: 'selected',
			processId: 30,
		});
	});

	test('does not select a historical MockMls process', () => {
		assert.deepStrictEqual(selectNewProcessId([10], [10]), { kind: 'waiting' });
	});

	test('refuses an ambiguous launch when more than one new MockMls process appears', () => {
		assert.deepStrictEqual(selectNewProcessId([10], [10, 20, 30]), {
			kind: 'ambiguous',
			processIds: [20, 30],
		});
	});

	test('waits until the launched MockMls process appears', async () => {
		const result = await waitForNewProcess(
			new SnapshotSequence([[10], [10, 20]]),
			[10],
			{ timeoutMs: 100, pollIntervalMs: 0 },
		);

		assert.deepStrictEqual(result, { kind: 'selected', processId: 20 });
	});

	test('returns a finite timeout when no launched process appears', async () => {
		const result = await waitForNewProcess(
			new SnapshotSequence([[10]]),
			[10],
			{ timeoutMs: 0, pollIntervalMs: 0 },
		);

		assert.deepStrictEqual(result, { kind: 'timeout' });
	});

	test('stops waiting when the launch is cancelled', async () => {
		const controller = new AbortController();
		controller.abort();

		const result = await waitForNewProcess(
			new SnapshotSequence([[10]]),
			[10],
			{ timeoutMs: 100, pollIntervalMs: 0, signal: controller.signal },
		);

		assert.deepStrictEqual(result, { kind: 'cancelled' });
	});

	test('does not deliver a PID when cancellation happens during a process query', async () => {
		const controller = new AbortController();
		let releaseQuery!: (processIds: readonly number[]) => void;
		const provider: ProcessSnapshotProvider = {
			listMockMlsProcessIds: () => new Promise((resolve) => {
				releaseQuery = resolve;
			}),
		};
		const waiting = waitForNewProcess(provider, [10], {
			timeoutMs: 100,
			pollIntervalMs: 0,
			signal: controller.signal,
		});
		controller.abort();
		releaseQuery([10, 20]);

		assert.deepStrictEqual(await waiting, { kind: 'cancelled' });
	});
});
