/**
 * y3makerConfig 的依赖桩。
 *
 * 生产环境里 'y3-helper' 由 webpack 解析，整条依赖链里还夹着只有 webpack 才成立的模块
 * （例如 plugin.ts 里的 __non_webpack_require__）、以及会碰工作区状态的 env。
 * 所以单元测试里把它们替换成桩，只测 y3makerConfig 自己的逻辑——与 baseBuilder.test.ts 同一套做法。
 */

/** 收集 y3.log.warn 收到的内容，方便断言“失败时确实记了日志” */
export const warnings: string[] = [];

export const log = {
	warn: (message: string) => { warnings.push(message); },
	info: () => { },
	error: () => { },
};

/** y3makerConfig 只用到 env.y3RepoUri（后台自动恢复时的判据），测试里不需要它 */
export const env: { y3RepoUri?: unknown } = {};

export const disposeMcpHub = () => { };

class MockSkillsHandler {
	public static getInstance(): MockSkillsHandler {
		return new MockSkillsHandler();
	}

	public dispose(): void { }
}

export default MockSkillsHandler;
