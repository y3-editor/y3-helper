import * as assert from 'assert';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {
    getY3LibraryDirState,
    initY3Library,
    isManagedY3LibraryRepo,
    isOwnedY3LibraryRepoUrl,
    isY3LibraryInitialized,
    listY3LibraryEntries,
} from '../../y3LibraryInit';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'y3-helper-y3lib-'));
let fixtureSeq = 0;

function makeProject(): vscode.Uri {
    const dir = path.join(tempRoot, `project-${fixtureSeq++}`);
    fs.mkdirSync(dir, { recursive: true });
    return vscode.Uri.file(dir);
}

function makeY3Dir(project: vscode.Uri): vscode.Uri {
    const y3Uri = vscode.Uri.joinPath(project, 'maps', 'map1', 'script', 'y3');
    fs.mkdirSync(path.join(y3Uri.fsPath, 'my-lib'), { recursive: true });
    fs.writeFileSync(path.join(y3Uri.fsPath, 'my-lib', 'mine.lua'), 'return 1\n');
    return y3Uri;
}

function read(file: string): string {
    return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

/** 模拟成功的 git clone：在目标目录写入仓库内容 */
function cloneThatWrites(target: vscode.Uri, calls: string[]): () => Promise<number> {
    return async () => {
        calls.push('clone');
        fs.mkdirSync(target.fsPath, { recursive: true });
        fs.writeFileSync(path.join(target.fsPath, 'README.md'), '# y3-lualib\n');
        fs.writeFileSync(path.join(target.fsPath, 'lib.lua'), 'return {}\n');
        return 0;
    };
}

/** 模拟失败的 git clone：留下一个半成品目录，且没有 README/HEAD */
function cloneThatFails(target: vscode.Uri, calls: string[]): () => Promise<number> {
    return async () => {
        calls.push('clone');
        fs.mkdirSync(target.fsPath, { recursive: true });
        fs.writeFileSync(path.join(target.fsPath, 'partial.pack'), 'x\n');
        return 128;
    };
}

function git(cwd: string, args: string[]): void {
    cp.execFileSync('git', args, { cwd, windowsHide: true, stdio: 'ignore' });
}

suite('Y3 库初始化', function () {
    this.timeout(60_000);

    suiteTeardown(() => {
        try {
            fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3 });
        } catch {
            // 夹具目录删不掉不影响测试结论
        }
    });

    // ─── 核心回归：取消不能删文件 ─────────────────────────────

    test('取消“请选择仓库来源”时，已有目录必须原样保留', async () => {
        const project = makeProject();
        const y3Uri = makeY3Dir(project);
        const calls: string[] = [];

        const result = await initY3Library({
            projectUri: project,
            y3Uri,
            prompts: {
                askRepoSource: async () => undefined,
                askUnmanagedAction: async () => { throw new Error('选了来源取消后不应再问备份'); },
            },
            clone: cloneThatWrites(y3Uri, calls),
        });

        assert.deepStrictEqual(result, { status: 'canceled', canceledAt: 'source' });
        assert.deepStrictEqual(calls, [], '取消后不应执行 clone');
        assert.strictEqual(read(path.join(y3Uri.fsPath, 'my-lib', 'mine.lua')), 'return 1\n', '原有文件必须还在');
        assert.ok(!fs.existsSync(path.join(project.fsPath, '.y3lualib-backup')), '取消后不应产生备份目录');
    });

    test('取消“备份并替换”时，已有目录必须原样保留', async () => {
        const project = makeProject();
        const y3Uri = makeY3Dir(project);
        const calls: string[] = [];
        let promptedEntries: string[] | undefined;

        const result = await initY3Library({
            projectUri: project,
            y3Uri,
            prompts: {
                askRepoSource: async () => 'github',
                askUnmanagedAction: async (_uri, entries) => {
                    promptedEntries = entries;
                    return 'cancel';
                },
            },
            clone: cloneThatWrites(y3Uri, calls),
        });

        assert.deepStrictEqual(result, { status: 'canceled', canceledAt: 'unmanaged' });
        assert.deepStrictEqual(calls, []);
        assert.deepStrictEqual(promptedEntries, ['my-lib/']);
        assert.strictEqual(read(path.join(y3Uri.fsPath, 'my-lib', 'mine.lua')), 'return 1\n');
        assert.ok(!fs.existsSync(path.join(project.fsPath, '.y3lualib-backup')));
    });

    // ─── 备份并替换 ──────────────────────────────────────────

    test('确认备份后：原内容进 .y3lualib-backup，目标换成新仓库', async () => {
        const project = makeProject();
        const y3Uri = makeY3Dir(project);
        const calls: string[] = [];

        const result = await initY3Library({
            projectUri: project,
            y3Uri,
            prompts: {
                askRepoSource: async () => 'github',
                askUnmanagedAction: async () => 'backup',
            },
            clone: cloneThatWrites(y3Uri, calls),
        });

        assert.strictEqual(result.status, 'success');
        assert.strictEqual(calls.length, 1);

        const backupRoot = path.join(project.fsPath, '.y3lualib-backup');
        const backups = fs.readdirSync(backupRoot);
        assert.strictEqual(backups.length, 1, '应产生且只产生一份备份');
        assert.strictEqual(read(path.join(backupRoot, backups[0], 'my-lib', 'mine.lua')), 'return 1\n', '备份里必须是完整原内容');

        assert.ok(fs.existsSync(path.join(y3Uri.fsPath, 'README.md')), '目标目录应换成新仓库');
        assert.ok(!fs.existsSync(path.join(y3Uri.fsPath, 'my-lib')), '旧内容不应留在目标目录');
    });

    test('空目录直接让位给 clone，不产生备份', async () => {
        const project = makeProject();
        const y3Uri = vscode.Uri.joinPath(project, 'maps', 'map1', 'script', 'y3');
        fs.mkdirSync(y3Uri.fsPath, { recursive: true });
        const calls: string[] = [];

        const result = await initY3Library({
            projectUri: project,
            y3Uri,
            prompts: {
                askRepoSource: async () => 'gitee',
                askUnmanagedAction: async () => { throw new Error('空目录不应询问备份'); },
            },
            clone: cloneThatWrites(y3Uri, calls),
        });

        assert.strictEqual(result.status, 'success');
        assert.ok(fs.existsSync(path.join(y3Uri.fsPath, 'README.md')));
        assert.ok(!fs.existsSync(path.join(project.fsPath, '.y3lualib-backup')));
    });

    // ─── 失败回滚 ────────────────────────────────────────────

    test('clone 失败时把备份还原回原位', async () => {
        const project = makeProject();
        const y3Uri = makeY3Dir(project);
        const calls: string[] = [];

        const result = await initY3Library({
            projectUri: project,
            y3Uri,
            prompts: {
                askRepoSource: async () => 'github',
                askUnmanagedAction: async () => 'backup',
            },
            clone: cloneThatFails(y3Uri, calls),
        });

        assert.strictEqual(result.status, 'clone-failed');
        if (result.status !== 'clone-failed') {
            throw new Error('结果应为 clone-failed');
        }
        assert.strictEqual(result.restored, true, '应尝试还原备份');
        assert.strictEqual(read(path.join(y3Uri.fsPath, 'my-lib', 'mine.lua')), 'return 1\n', '原有文件必须被还原');
        assert.ok(!fs.existsSync(path.join(y3Uri.fsPath, 'partial.pack')), '半成品应被清理');
    });

    test('clone 抛异常时也走回滚', async () => {
        const project = makeProject();
        const y3Uri = makeY3Dir(project);

        const result = await initY3Library({
            projectUri: project,
            y3Uri,
            prompts: {
                askRepoSource: async () => 'github',
                askUnmanagedAction: async () => 'backup',
            },
            clone: async () => { throw new Error('任务启动失败'); },
        });

        assert.strictEqual(result.status, 'clone-failed');
        if (result.status !== 'clone-failed') {
            throw new Error('结果应为 clone-failed');
        }
        assert.strictEqual(result.restored, true);
        assert.strictEqual(read(path.join(y3Uri.fsPath, 'my-lib', 'mine.lua')), 'return 1\n');
    });

    // ─── 目录状态 ────────────────────────────────────────────

    test('.git 是目录时视为已初始化，不提示、不删除、不 clone', async () => {
        const project = makeProject();
        const y3Uri = vscode.Uri.joinPath(project, 'maps', 'map1', 'script', 'y3');
        fs.mkdirSync(path.join(y3Uri.fsPath, '.git'), { recursive: true });
        fs.writeFileSync(path.join(y3Uri.fsPath, 'CHANGELOG.md'), 'x\n');
        const calls: string[] = [];

        const result = await initY3Library({
            projectUri: project,
            y3Uri,
            prompts: {
                askRepoSource: async () => { throw new Error('已初始化时不应询问'); },
                askUnmanagedAction: async () => { throw new Error('已初始化时不应询问'); },
            },
            clone: cloneThatWrites(y3Uri, calls),
        });

        assert.deepStrictEqual(result, { status: 'initialized' });
        assert.deepStrictEqual(calls, []);
        assert.ok(fs.existsSync(path.join(y3Uri.fsPath, 'CHANGELOG.md')));
    });

    test('.git 是文件（worktree/submodule 形态）时按未接管处理，取消后不动', async () => {
        const project = makeProject();
        const y3Uri = vscode.Uri.joinPath(project, 'maps', 'map1', 'script', 'y3');
        fs.mkdirSync(y3Uri.fsPath, { recursive: true });
        fs.writeFileSync(path.join(y3Uri.fsPath, '.git'), 'gitdir: ../somewhere/.git\n');
        const calls: string[] = [];

        assert.strictEqual(await getY3LibraryDirState(y3Uri), 'unmanaged');

        const result = await initY3Library({
            projectUri: project,
            y3Uri,
            prompts: {
                askRepoSource: async () => 'github',
                askUnmanagedAction: async () => 'cancel',
            },
            clone: cloneThatWrites(y3Uri, calls),
        });

        assert.strictEqual(result.status, 'canceled');
        assert.strictEqual(read(path.join(y3Uri.fsPath, '.git')), 'gitdir: ../somewhere/.git\n');
    });

    test('带 CHANGELOG 但没有 .git 的自维护副本不算已初始化', async () => {
        const project = makeProject();
        const y3Uri = vscode.Uri.joinPath(project, 'y3');
        fs.mkdirSync(y3Uri.fsPath, { recursive: true });
        fs.writeFileSync(path.join(y3Uri.fsPath, 'CHANGELOG.md'), '# 更新日志\n');

        assert.strictEqual(await getY3LibraryDirState(y3Uri), 'unmanaged');
        assert.strictEqual(await isY3LibraryInitialized(y3Uri), false);
    });

    test('.git 是目录时 isY3LibraryInitialized 为 true', async () => {
        const project = makeProject();
        const y3Uri = vscode.Uri.joinPath(project, 'y3');
        fs.mkdirSync(path.join(y3Uri.fsPath, '.git'), { recursive: true });

        assert.strictEqual(await isY3LibraryInitialized(y3Uri), true);
    });

    test('带 CHANGELOG 的自维护副本仍会弹出备份确认（侧边栏入口应可见）', async () => {
        const project = makeProject();
        const y3Uri = makeY3Dir(project);
        fs.writeFileSync(path.join(y3Uri.fsPath, 'CHANGELOG.md'), '# 更新日志\n');
        const calls: string[] = [];
        let asked = false;

        const result = await initY3Library({
            projectUri: project,
            y3Uri,
            prompts: {
                askRepoSource: async () => 'github',
                askUnmanagedAction: async () => {
                    asked = true;
                    return 'cancel';
                },
            },
            clone: cloneThatWrites(y3Uri, calls),
        });

        assert.strictEqual(result.status, 'canceled');
        assert.strictEqual(asked, true, '带 CHANGELOG 的副本仍应询问是否备份替换');
        assert.deepStrictEqual(calls, []);
        assert.strictEqual(read(path.join(y3Uri.fsPath, 'my-lib', 'mine.lua')), 'return 1\n');
        assert.ok(fs.existsSync(path.join(y3Uri.fsPath, 'CHANGELOG.md')));
    });

    test('路径被文件占用时返回 occupied', async () => {
        const project = makeProject();
        const y3Uri = vscode.Uri.joinPath(project, 'maps', 'map1', 'script', 'y3');
        fs.mkdirSync(path.dirname(y3Uri.fsPath), { recursive: true });
        fs.writeFileSync(y3Uri.fsPath, 'not a dir\n');

        assert.strictEqual(await getY3LibraryDirState(y3Uri), 'occupied');
        const result = await initY3Library({
            projectUri: project,
            y3Uri,
            prompts: {
                askRepoSource: async () => { throw new Error('占用时不应询问'); },
                askUnmanagedAction: async () => { throw new Error('占用时不应询问'); },
            },
            clone: async () => 0,
        });
        assert.deepStrictEqual(result, { status: 'occupied' });
        assert.strictEqual(read(y3Uri.fsPath), 'not a dir\n');
    });

    test('目录不存在时直接 clone，不产生备份', async () => {
        const project = makeProject();
        const y3Uri = vscode.Uri.joinPath(project, 'maps', 'map1', 'script', 'y3');
        const calls: string[] = [];
        let askedSource = false;

        const result = await initY3Library({
            projectUri: project,
            y3Uri,
            prompts: {
                askRepoSource: async () => { askedSource = true; return 'github'; },
                askUnmanagedAction: async () => { throw new Error('不存在时不应询问备份'); },
            },
            clone: cloneThatWrites(y3Uri, calls),
        });

        assert.strictEqual(result.status, 'success');
        assert.strictEqual(askedSource, true);
        assert.ok(fs.existsSync(path.join(y3Uri.fsPath, 'README.md')));
        assert.ok(!fs.existsSync(path.join(project.fsPath, '.y3lualib-backup')));
    });

    // ─── 归属判定 ────────────────────────────────────────────

    suite('仓库归属判定', () => {
        test('三条官方地址都认', () => {
            assert.strictEqual(isOwnedY3LibraryRepoUrl('https://github.com/y3-editor/y3-lualib.git'), true);
            assert.strictEqual(isOwnedY3LibraryRepoUrl('https://gitee.com/tsukiko/y3-lualib.git'), true);
            assert.strictEqual(isOwnedY3LibraryRepoUrl('https://github.com/CliCli-Editor/lualib.git'), true);
            assert.strictEqual(isOwnedY3LibraryRepoUrl('C:\\repos\\y3-lualib'), true);
        });

        test('别人的 fork 和别的仓库都不认', () => {
            assert.strictEqual(isOwnedY3LibraryRepoUrl('https://github.com/someone/y3-lualib-fork.git'), false);
            assert.strictEqual(isOwnedY3LibraryRepoUrl('https://github.com/y3-editor/y3-maker-config.git'), false);
            assert.strictEqual(isOwnedY3LibraryRepoUrl(''), false);
        });

        test('isManagedY3LibraryRepo 要求 .git 是目录且 origin 是官方仓库', async () => {
            const project = makeProject();

            const managed = vscode.Uri.joinPath(project, 'managed');
            fs.mkdirSync(managed.fsPath, { recursive: true });
            git(managed.fsPath, ['init']);
            git(managed.fsPath, ['remote', 'add', 'origin', 'https://github.com/y3-editor/y3-lualib.git']);
            assert.strictEqual(await isManagedY3LibraryRepo(managed), true);

            const foreign = vscode.Uri.joinPath(project, 'foreign');
            fs.mkdirSync(foreign.fsPath, { recursive: true });
            git(foreign.fsPath, ['init']);
            git(foreign.fsPath, ['remote', 'add', 'origin', 'https://github.com/someone/my-fork.git']);
            assert.strictEqual(await isManagedY3LibraryRepo(foreign), false);

            const plain = vscode.Uri.joinPath(project, 'plain');
            fs.mkdirSync(plain.fsPath, { recursive: true });
            assert.strictEqual(await isManagedY3LibraryRepo(plain), false);

            const worktree = vscode.Uri.joinPath(project, 'worktree');
            fs.mkdirSync(worktree.fsPath, { recursive: true });
            fs.writeFileSync(path.join(worktree.fsPath, '.git'), 'gitdir: ../somewhere/.git\n');
            assert.strictEqual(await isManagedY3LibraryRepo(worktree), false);
        });
    });

    test('listY3LibraryEntries 排序并给目录加斜杠', async () => {
        const project = makeProject();
        const y3Uri = vscode.Uri.joinPath(project, 'y3');
        fs.mkdirSync(path.join(y3Uri.fsPath, 'alpha'), { recursive: true });
        fs.writeFileSync(path.join(y3Uri.fsPath, 'beta.md'), 'x\n');

        assert.deepStrictEqual(await listY3LibraryEntries(y3Uri), ['alpha/', 'beta.md']);
    });
});
