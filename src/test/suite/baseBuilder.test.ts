import * as assert from 'assert';

type ResolveFilename = (this: unknown, request: string, ...args: unknown[]) => string;

// Production resolves y3-helper through webpack; this keeps the unit test Node-only.
function loadBaseBuilderWithMockedDependencies(): typeof import('../../metaBuilder/baseBuilder') {
	const moduleLoader = require('module') as { _resolveFilename: ResolveFilename };
	const originalResolveFilename = moduleLoader._resolveFilename;
	const mockPath = require.resolve('./baseBuilderDependenciesMock');
	const baseBuilderPath = require.resolve('../../metaBuilder/baseBuilder');
	const mockedRequests = new Set(['y3-helper', '../tools/fs']);

	delete require.cache[baseBuilderPath];
	moduleLoader._resolveFilename = function(this: unknown, request: string, ...args: unknown[]) {
		if (mockedRequests.has(request)) {
			return mockPath;
		}
		return Reflect.apply(originalResolveFilename, this, [request, ...args]);
	};
	try {
		return require(baseBuilderPath) as typeof import('../../metaBuilder/baseBuilder');
	} finally {
		delete require.cache[baseBuilderPath];
		moduleLoader._resolveFilename = originalResolveFilename;
	}
}

const { env } = require('./baseBuilderDependenciesMock') as typeof import('./baseBuilderDependenciesMock');
const { BaseBuilder } = loadBaseBuilderWithMockedDependencies();

type Y3Map = import('../../env').Map;

function waitForThrottle(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 650));
}

suite('BaseBuilder', () => {
	test('waits until the project map list is populated', async function() {
		this.timeout(4000);

		const project = { maps: [] as Y3Map[] };
		const map = { name: 'EntryMap' } as Y3Map;

		env.project = project;

		class RecordingBuilder extends BaseBuilder {
			public updatedMaps: Y3Map[] = [];

			public async updateMap(updatedMap: Y3Map) {
				this.updatedMaps.push(updatedMap);
			}

			protected async make(): Promise<string | undefined> {
				return undefined;
			}
		}

		try {
			const builder = new RecordingBuilder('meta/test.lua');
			builder.updateAll();
			await waitForThrottle();

			assert.deepStrictEqual(builder.updatedMaps, []);
			assert.strictEqual(env.listenerCount, 1);

			env.fireDidChange();
			assert.strictEqual(env.listenerCount, 1);

			project.maps.push(map);
			env.fireDidChange();
			await waitForThrottle();

			assert.deepStrictEqual(builder.updatedMaps, [map]);
			assert.strictEqual(env.listenerCount, 0);
		} finally {
			env.reset();
		}
	});
});
