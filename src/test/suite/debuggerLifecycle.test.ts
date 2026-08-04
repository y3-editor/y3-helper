import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function repoRoot(): string {
	let current = __dirname;
	while (current !== path.dirname(current)) {
		if (fs.existsSync(path.join(current, 'package.json'))) {
			return current;
		}
		current = path.dirname(current);
	}
	throw new Error('Unable to locate repository root');
}

function readDebuggerLua(relativePath: string): string {
	return stripLuaComments(fs.readFileSync(
		path.join(repoRoot(), '3rd', 'debugger', 'script', ...relativePath.split('/')),
		'utf8',
	));
}

function readSource(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot(), ...relativePath.split('/')), 'utf8');
}

function stripLuaComments(source: string): string {
	return source
		.replace(/--\[\[[\s\S]*?\]\]/g, '')
		.replace(/--[^\r\n]*/g, '');
}

function extractSection(source: string, startMarker: string, endMarker: string): string {
	const start = source.indexOf(startMarker);
	assert.notStrictEqual(start, -1, `missing section start marker: ${startMarker}`);

	const end = source.indexOf(endMarker, start + startMarker.length);
	assert.notStrictEqual(end, -1, `missing section end marker: ${endMarker}`);

	return source.slice(start, end);
}

suite('Debugger Lua lifecycle', () => {
	test('bootstrap does not shut down the master thread from first worker garbage collection', () => {
		const bootstrap = readDebuggerLua('backend/bootstrap.lua');
		const initMaster = extractSection(bootstrap, 'local function initMaster', 'local function startWorker');

		assert.ok(!/\bExitGuard\b/.test(initMaster), 'initMaster should not install a first-worker ExitGuard');
		assert.ok(!/\bthread\s*\.\s*wait\s*\(/.test(initMaster), 'initMaster should not wait for the master thread during first-worker GC');
	});

	test('master does not require a special EXIT message before worker shutdown can end the loop', () => {
		const mgr = readDebuggerLua('backend/master/mgr.lua');
		const updateOnce = extractSection(mgr, 'local function update_once', 'function mgr.update');

		assert.ok(!/\bexitMaster\b/.test(mgr), 'master lifecycle should not be gated by exitMaster state');
		assert.ok(!/cmd\s*==\s*["']EXIT["']/.test(updateOnce), 'update_once should not handle a special EXIT shutdown command');
	});

	test('exitWorker quits exactly when the last worker channel has been removed', () => {
		const mgr = readDebuggerLua('backend/master/mgr.lua');
		const exitWorker = extractSection(mgr, 'function mgr.exitWorker', 'local function update_redirect');

		assert.match(exitWorker, /threadChannel\s*\[\s*w\s*\]\s*=\s*nil/, 'exitWorker should remove the exiting worker channel');
		assert.match(exitWorker, /if\s+next\s*\(\s*threadChannel\s*\)\s*==\s*nil\s+then[\s\S]*?\bquit\s*=\s*true/, 'exitWorker should quit when no worker channels remain');
		assert.ok(!/\bexitMaster\b/.test(exitWorker), 'exitWorker should not wait for master EXIT state after the last worker exits');
	});

	test('master destroys DbgMaster only after the update loop has shut down', () => {
		const mgr = readDebuggerLua('backend/master/mgr.lua');
		const update = extractSection(mgr, 'function mgr.update', 'function mgr.setClient');
		const loop = update.indexOf('while not quit do');
		const closeAll = update.indexOf('socket.closeall()');
		const destroy = update.search(/channel\s*\.\s*destroy\s*\(?\s*["']DbgMaster["']\s*\)?/);

		assert.notStrictEqual(loop, -1, 'mgr.update should run until quit is set');
		assert.notStrictEqual(closeAll, -1, 'mgr.update should close sockets during shutdown');
		assert.notStrictEqual(destroy, -1, 'mgr.update should destroy the DbgMaster channel');
		assert.ok(closeAll > loop, 'mgr.update should close sockets after the update loop exits');
		assert.ok(destroy > closeAll, 'mgr.update should destroy DbgMaster after shutdown cleanup');
	});

	test('worker destroys its channel after notifying master that it exited', () => {
		const worker = readDebuggerLua('backend/worker.lua');
		const eventExit = extractSection(worker, 'function event.exit', 'hookmgr.init');
		const notify = eventExit.search(/sendToMaster\s*["']exitWorker["']\s*\{\s*\}/);
		const destroy = eventExit.search(/channel\s*\.\s*destroy\s*\(?\s*WorkerChannel\s*\)?/);

		assert.notStrictEqual(notify, -1, 'event.exit should notify master with exitWorker');
		assert.notStrictEqual(destroy, -1, 'event.exit should destroy the worker channel');
		assert.ok(destroy > notify, 'event.exit should destroy WorkerChannel after sending exitWorker');
	});

	test('wait-debugger fallback attaches missing players without restarting active sessions', () => {
		const debug = readSource('src/debug.ts');
		const checkNeedAttach = extractSection(
			debug,
			'async function checkNeedAttach',
			'async function startWaitDebuggerHelper',
		);

		assert.match(
			checkNeedAttach,
			/planMissingMultiDebugPlayers\s*\(/,
			'fallback should plan against configured per-player sessions',
		);
		assert.match(
			checkNeedAttach,
			/missingPlayerIds[\s\S]*?attachForOnePlayer\s*\(/,
			'fallback should attach only the missing player ids',
		);
		assert.ok(
			!/(?:^|[^\w])attach\s*\(\s*\)/m.test(checkNeedAttach),
			'fallback must not call attach(), which stops every active debug session',
		);
	});

	test('wait-debugger marker is consumed only after missing-player attachment succeeds', () => {
		const debug = readSource('src/debug.ts');
		const checkNeedAttach = extractSection(
			debug,
			'async function checkNeedAttach',
			'async function startWaitDebuggerHelper',
		);
		const plan = checkNeedAttach.indexOf('planMissingMultiDebugPlayers');
		const attach = checkNeedAttach.indexOf('attachForOnePlayer', plan);
		const allSucceeded = checkNeedAttach.indexOf('results.every', attach);
		const remove = checkNeedAttach.indexOf('removeWaitDebuggerFiles', allSucceeded);

		assert.notStrictEqual(plan, -1, 'fallback should create a missing-player plan');
		assert.notStrictEqual(attach, -1, 'fallback should attempt the planned player attaches');
		assert.notStrictEqual(allSucceeded, -1, 'fallback should verify every planned attach succeeded');
		assert.notStrictEqual(remove, -1, 'fallback should consume handled wait markers');
		assert.ok(attach > plan, 'fallback should calculate missing players before attaching');
		assert.ok(allSucceeded > attach, 'fallback should check success after attempting attachment');
		assert.ok(remove > allSucceeded, 'fallback should retain the marker until attachment succeeds');
	});
});
