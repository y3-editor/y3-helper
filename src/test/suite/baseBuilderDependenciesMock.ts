type Listener = () => void;

interface TestMap {
	name: string;
}

class TestEnvironment {
	public project: { maps: TestMap[] } | undefined;
	private listeners = new Set<Listener>();

	public onDidChange = (listener: Listener) => {
		this.listeners.add(listener);
		return {
			dispose: () => {
				this.listeners.delete(listener);
			},
		};
	};

	public fireDidChange() {
		for (const listener of [...this.listeners]) {
			listener();
		}
	}

	public get listenerCount() {
		return this.listeners.size;
	}

	public reset() {
		this.project = undefined;
		this.listeners.clear();
	}
}

export const env = new TestEnvironment();

async function unexpectedFileSystemAccess(): Promise<never> {
	throw new Error('BaseBuilder readiness tests must not access the file system.');
}

export const isExists = unexpectedFileSystemAccess;
export const readFile = unexpectedFileSystemAccess;
export const writeFile = unexpectedFileSystemAccess;
