import * as assert from 'assert';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { warnings } from './y3makerConfigDependenciesMock';

type ResolveFilename = (this: unknown, request: string, ...args: unknown[]) => string;

/**
 * 把 y3makerConfig 的对外依赖换成桩之后再加载它。
 * 做法与 baseBuilder.test.ts 一致：生产里这些依赖要么由 webpack 解析，要么需要真实工作区。
 */
function loadY3MakerConfig(): typeof import('../../y3makerConfig') {
    const moduleLoader = require('module') as { _resolveFilename: ResolveFilename };
    const originalResolveFilename = moduleLoader._resolveFilename;
    const mockPath = require.resolve('./y3makerConfigDependenciesMock');
    const modulePath = require.resolve('../../y3makerConfig');
    const mockedRequests = new Set([
        'y3-helper',
        './env',
        './codemaker/skillsHandler',
        './codemaker/mcpHandlers',
    ]);

    delete require.cache[modulePath];
    moduleLoader._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
        if (mockedRequests.has(request)) {
            return mockPath;
        }
        return Reflect.apply(originalResolveFilename, this, [request, ...args]);
    };
    try {
        return require(modulePath) as typeof import('../../y3makerConfig');
    } finally {
        moduleLoader._resolveFilename = originalResolveFilename;
    }
}

const mockEnv = require('./y3makerConfigDependenciesMock').env as { y3RepoUri?: vscode.Uri };

const {
    checkForUpdates,
    detectRepoUrl,
    getCloneY3MakerPreference,
    getY3MakerDirState,
    listY3MakerEntries,
    mergeY3MakerFromRemote,
    replaceY3MakerFromRemote,
} = loadY3MakerConfig();

// ─── 夹具 ────────────────────────────────────────────────────

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'y3-helper-y3maker-'));

function git(cwd: string, args: string[]): string {
    return cp.execFileSync('git', args, {
        cwd,
        windowsHide: true,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
}

function gitExitCode(cwd: string, args: string[]): number {
    try {
        cp.execFileSync('git', args, { cwd, windowsHide: true, stdio: 'ignore' });
        return 0;
    } catch (error) {
        return (error as any).status ?? 1;
    }
}

/** git status 这类输出必须按行看：首列是状态字符，不能被 trim 掉 */
function gitLines(cwd: string, args: string[]): string[] {
    return cp.execFileSync('git', args, {
        cwd,
        windowsHide: true,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).split('\n').map((line) => line.replace(/\r$/, '')).filter((line) => line !== '');
}

/** git 需要身份信息才能提交，测试里只配在夹具仓库本地 */
function commitAll(dir: string, message: string): void {
    git(dir, ['-c', 'user.email=test@example.com', '-c', 'user.name=test', 'add', '-A']);
    git(dir, ['-c', 'user.email=test@example.com', '-c', 'user.name=test', 'commit', '-m', message]);
}

function fileUrl(target: string): string {
    return 'file:///' + target.replace(/\\/g, '/');
}

let fixtureSeq = 0;
function makeTempDir(prefix: string): string {
    const dir = path.join(tempRoot, `${prefix}-${fixtureSeq++}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * 造一个假的 y3-maker-config 远端仓库。
 * 用 file:// 而不是网络地址：测试可离线、可重复，且 URL 末尾仍是 /y3-maker-config。
 */
function makeRemoteRepo(): { url: string; dir: string } {
    // 目录名必须正好以 y3-maker-config 结尾，否则会被状态判定当成别人的仓库
    const dir = path.join(makeTempDir('remote'), 'y3-maker-config');
    fs.mkdirSync(dir);
    git(dir, ['init', '-b', 'main']);
    fs.mkdirSync(path.join(dir, 'rules'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'skills', 'builtin-skill'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'knowledge'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'rules', 'mcp-rules.mdc'), '远端规则\n');
    fs.writeFileSync(path.join(dir, 'skills', 'builtin-skill', 'SKILL.md'), '远端技能\n');
    fs.writeFileSync(path.join(dir, 'skills', 'README.md'), '远端技能说明\n');
    fs.writeFileSync(path.join(dir, 'knowledge', 'README.md'), '远端知识库\n');
    fs.writeFileSync(path.join(dir, 'mcp_settings.json'), '{ "mcpServers": {} }\n');
    commitAll(dir, 'init remote');
    // 再来一个提交，测试里要能 reset --hard HEAD~1 造出“落后一个提交”
    fs.writeFileSync(path.join(dir, 'knowledge', 'README.md'), '远端知识库（更新）\n');
    commitAll(dir, 'update knowledge');
    return { dir, url: fileUrl(dir) };
}

function makeProject(): vscode.Uri {
    return vscode.Uri.file(makeTempDir('project'));
}

function read(file: string): string {
    // 本机 core.autocrlf=true，clone 出来的文本是 CRLF，比较前统一成 LF
    return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function backupDirsOf(projectDir: string): string[] {
    return fs.readdirSync(projectDir).filter((name) => name.startsWith('.y3maker.bak-'));
}

/** 造一个"有目录、没 .git"的 partial 状态 */
function makePartial(project: vscode.Uri): string {
    const dir = path.join(project.fsPath, '.y3maker');
    fs.mkdirSync(path.join(dir, 'skills', 'my-skill'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'skills', 'my-skill', 'SKILL.md'), '我的技能\n');
    fs.writeFileSync(path.join(dir, 'mcp_settings.json'), '{ "mine": true }\n');
    return dir;
}

function cloneRemoteTo(remoteUrl: string, target: string): void {
    git(path.dirname(target), ['clone', '--quiet', remoteUrl, target]);
}

// 每条用例都要起好几个 git 进程（有的还要 clone），mocha 默认 2 秒不够
suite('Y3Maker 配置拉取', function () {
    this.timeout(60_000);

    suiteTeardown(() => {
        try {
            fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3 });
        } catch {
            // 夹具目录删不掉不影响测试结论
        }
    });

    // ─── 状态判定 ────────────────────────────────────────────

    suite('状态判定', () => {
        test('目录不存在 → missing', async () => {
            const project = makeProject();
            assert.strictEqual(await getY3MakerDirState(project), 'missing');
        });

        test('有目录但没有 .git → partial', async () => {
            const project = makeProject();
            makePartial(project);
            assert.strictEqual(await getY3MakerDirState(project), 'partial');
        });

        test('空目录也算 partial', async () => {
            const project = makeProject();
            fs.mkdirSync(path.join(project.fsPath, '.y3maker'), { recursive: true });
            assert.strictEqual(await getY3MakerDirState(project), 'partial');
        });

        test('clone 自我们仓库 → managed', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            cloneRemoteTo(remote.url, path.join(project.fsPath, '.y3maker'));
            assert.strictEqual(await getY3MakerDirState(project), 'managed');
        });

        test('自己的别人仓库 → foreign', async () => {
            const project = makeProject();
            const dir = path.join(project.fsPath, '.y3maker');
            fs.mkdirSync(dir, { recursive: true });
            git(dir, ['init', '-b', 'main']);
            git(dir, ['remote', 'add', 'origin', 'https://github.com/someone/other-repo.git']);
            assert.strictEqual(await getY3MakerDirState(project), 'foreign');
        });

        test('git init 但没有 remote → foreign（不会被我们接管）', async () => {
            const project = makeProject();
            const dir = path.join(project.fsPath, '.y3maker');
            fs.mkdirSync(dir, { recursive: true });
            git(dir, ['init', '-b', 'main']);
            assert.strictEqual(await getY3MakerDirState(project), 'foreign');
        });

        test('.git 是文件（gitfile / submodule 形态）→ foreign', async () => {
            const project = makeProject();
            const dir = path.join(project.fsPath, '.y3maker');
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, '.git'), 'gitdir: ../somewhere/.git\n');
            assert.strictEqual(await getY3MakerDirState(project), 'foreign');
        });

        test('remote 是 Windows 本地路径也认成 managed', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            const dir = path.join(project.fsPath, '.y3maker');
            fs.mkdirSync(dir, { recursive: true });
            git(dir, ['init', '-b', 'main']);
            // 故意用反斜杠的本地路径形式
            git(dir, ['remote', 'add', 'origin', remote.dir]);
            assert.strictEqual(await getY3MakerDirState(project), 'managed');
        });
    });

    // ─── 目录清单 ────────────────────────────────────────────

    suite('listY3MakerEntries', () => {
        test('列出顶层条目，目录带斜杠', async () => {
            const project = makeProject();
            makePartial(project);
            const entries = await listY3MakerEntries(project);
            assert.deepStrictEqual(entries, ['mcp_settings.json', 'skills/']);
        });

        test('目录不存在时返回空数组', async () => {
            const project = makeProject();
            assert.deepStrictEqual(await listY3MakerEntries(project), []);
        });
    });

    // ─── 合并 ────────────────────────────────────────────────

    suite('合并（保留本地、补齐缺失、纳入 git）', () => {
        test('同名保留本地，缺的顶层条目补进来', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            const dir = makePartial(project);

            const result = await mergeY3MakerFromRemote(project, remote.url);

            assert.strictEqual(result.ok, true, '合并应成功');
            assert.strictEqual(read(path.join(dir, 'mcp_settings.json')), '{ "mine": true }\n', '本地同名文件不能被覆盖');
            assert.strictEqual(read(path.join(dir, 'skills', 'my-skill', 'SKILL.md')), '我的技能\n', '本地技能不能被覆盖');
            assert.ok(fs.existsSync(path.join(dir, 'rules', 'mcp-rules.mdc')), '远端独有的 rules/ 应被补进来');
            assert.ok(fs.existsSync(path.join(dir, 'knowledge', 'README.md')), '远端独有的 knowledge/ 应被补进来');
        });

        test('本地没有 skills/ 时，远端的 skills/ 会被整目录补进来', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            const dir = path.join(project.fsPath, '.y3maker');
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'mcp_settings.json'), '{ "mine": true }\n');

            const result = await mergeY3MakerFromRemote(project, remote.url);

            assert.strictEqual(result.ok, true);
            assert.ok(fs.existsSync(path.join(dir, 'skills', 'builtin-skill', 'SKILL.md')));
            assert.strictEqual(read(path.join(dir, 'mcp_settings.json')), '{ "mine": true }\n');
        });

        test('合并后是可用仓库：HEAD == origin/main、分支 main、upstream 正确', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            const dir = makePartial(project);
            await mergeY3MakerFromRemote(project, remote.url);

            assert.strictEqual(git(dir, ['branch', '--show-current']), 'main');
            assert.strictEqual(git(dir, ['rev-parse', 'HEAD']), git(dir, ['rev-parse', 'origin/main']));
            assert.strictEqual(git(dir, ['rev-parse', '--abbrev-ref', 'main@{upstream}']), 'origin/main');
        });

        test('合并后能 pull，本地差异显示为修改/未跟踪', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            const dir = makePartial(project);
            await mergeY3MakerFromRemote(project, remote.url);

            assert.strictEqual(gitExitCode(dir, ['pull', '--quiet']), 0, '合并后应能正常 pull');

            const status = gitLines(dir, ['status', '--porcelain']);
            assert.ok(status.includes(' M mcp_settings.json'), `改过的被跟踪文件应显示为本地修改，实际：${JSON.stringify(status)}`);
            assert.ok(status.includes('?? skills/my-skill/'), `本地独有文件应显示为未跟踪，实际：${JSON.stringify(status)}`);
            assert.strictEqual(await getY3MakerDirState(project), 'managed');
        });

        test('远端地址无效时合并不改任何东西', async () => {
            const project = makeProject();
            const dir = makePartial(project);
            const bogus = fileUrl(path.join(tempRoot, '不存在的仓库', 'y3-maker-config'));
            warnings.length = 0;

            const result = await mergeY3MakerFromRemote(project, bogus);

            assert.strictEqual(result.ok, false);
            assert.ok(warnings.some((w) => w.includes('拉取 y3-maker-config 失败')), '失败时应留下日志');
            assert.strictEqual(read(path.join(dir, 'mcp_settings.json')), '{ "mine": true }\n');
            assert.strictEqual(read(path.join(dir, 'skills', 'my-skill', 'SKILL.md')), '我的技能\n');
            assert.ok(!fs.existsSync(path.join(dir, '.git')), '失败时不该把目录变成 git 仓库');
            assert.ok(!fs.existsSync(path.join(project.fsPath, '.y3maker.staging')), '失败时不该留下暂存目录');
        });
    });

    // ─── 备份并替换 ──────────────────────────────────────────

    suite('备份并替换', () => {
        test('原内容进时间戳备份，新目录是干净的一份', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            const dir = makePartial(project);

            const result = await replaceY3MakerFromRemote(project, remote.url);

            assert.strictEqual(result.ok, true);
            assert.ok(result.backupDir, '应返回备份目录名');
            assert.match(result.backupDir!, /^\.y3maker\.bak-\d{8}-\d{6}$/, '备份目录名应带时间戳');
            assert.strictEqual(read(path.join(project.fsPath, result.backupDir!, 'mcp_settings.json')), '{ "mine": true }\n');
            assert.ok(fs.existsSync(path.join(project.fsPath, result.backupDir!, 'skills', 'my-skill', 'SKILL.md')), '原技能应在备份里');

            assert.strictEqual(read(path.join(dir, 'mcp_settings.json')), '{ "mcpServers": {} }\n', '新目录应是远端内容');
            assert.strictEqual(git(dir, ['status', '--porcelain']), '', '新目录应是干净的 clone');
            assert.strictEqual(await getY3MakerDirState(project), 'managed');
            assert.ok(!fs.existsSync(path.join(project.fsPath, '.y3maker.staging')), '不该留下暂存目录');
        });

        test('第二次替换不会覆盖第一次的备份', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            makePartial(project);

            const first = await replaceY3MakerFromRemote(project, remote.url);
            // 让新目录再次有本地内容，制造第二次替换
            fs.writeFileSync(path.join(project.fsPath, '.y3maker', 'mcp_settings.json'), '{ "second": true }\n');
            const second = await replaceY3MakerFromRemote(project, remote.url);

            assert.notStrictEqual(first.backupDir, second.backupDir);
            assert.match(first.backupDir!, /^\.y3maker\.bak-\d{8}-\d{6}$/);
            // 同一秒内连续备份时会在时间戳后面加序号，但绝不能同名
            assert.match(second.backupDir!, /^\.y3maker\.bak-\d{8}-\d{6}(-\d+)?$/);
            assert.strictEqual(backupDirsOf(project.fsPath).length, 2, '应保留两代备份');
            assert.strictEqual(read(path.join(project.fsPath, first.backupDir!, 'mcp_settings.json')), '{ "mine": true }\n');
            assert.strictEqual(read(path.join(project.fsPath, second.backupDir!, 'mcp_settings.json')), '{ "second": true }\n');
        });

        test('目录不存在时替换 = 直接 clone，不产生备份', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();

            const result = await replaceY3MakerFromRemote(project, remote.url);

            assert.strictEqual(result.ok, true);
            assert.strictEqual(result.backupDir, undefined, '没有东西可备份时不该造空备份目录');
            assert.deepStrictEqual(backupDirsOf(project.fsPath), []);
            assert.ok(fs.existsSync(path.join(project.fsPath, '.y3maker', 'rules', 'mcp-rules.mdc')));
            assert.strictEqual(await getY3MakerDirState(project), 'managed');
        });

        test('远端地址无效时替换不改任何东西，也不产生备份', async () => {
            const project = makeProject();
            const dir = makePartial(project);
            const bogus = fileUrl(path.join(tempRoot, '不存在的仓库2', 'y3-maker-config'));
            warnings.length = 0;

            const result = await replaceY3MakerFromRemote(project, bogus);

            assert.strictEqual(result.ok, false);
            assert.ok(warnings.some((w) => w.includes('拉取 y3-maker-config 失败')), '失败时应留下日志');
            assert.deepStrictEqual(backupDirsOf(project.fsPath), [], '克隆失败不该产生备份');
            assert.strictEqual(read(path.join(dir, 'mcp_settings.json')), '{ "mine": true }\n', '原文件必须原样还在');
            assert.strictEqual(read(path.join(dir, 'skills', 'my-skill', 'SKILL.md')), '我的技能\n');
            assert.ok(!fs.existsSync(path.join(project.fsPath, '.y3maker.staging')));
        });

        test('残留的 .y3maker.staging 会在下一次动作前被清掉', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            makePartial(project);
            const stale = path.join(project.fsPath, '.y3maker.staging');
            fs.mkdirSync(stale, { recursive: true });
            fs.writeFileSync(path.join(stale, 'stale.txt'), '旧残留\n');

            const result = await replaceY3MakerFromRemote(project, remote.url);

            assert.strictEqual(result.ok, true);
            assert.ok(!fs.existsSync(stale), '暂存目录应被清掉');
            assert.ok(!fs.existsSync(path.join(stale, 'stale.txt')));
        });
    });

    // ─── 更新检查的门槛 ──────────────────────────────────────

    suite('LFS 资产', () => {
        test('远端资产是 LFS 占位指针时，拉取仍然成功（不因为 LFS 下不下来而整体失败）', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            // 远端仓库里那个 134MB 的地形模板 zip 是 LFS 对象；托管方不给下的时候，
            // 工作区里留下的就是这种文本指针。拉取流程必须照样成功。
            const pointer = [
                'version https://git-lfs.github.com/spec/v1',
                'oid sha256:ffcbc58ad32bc8b5c25ce8375be9bf6bf758b96794c49167f3b5de818b8e8878',
                'size 134520241',
                '',
            ].join('\n');
            const rel = path.join('skills', 'y3-terrain-template', 'editor_decoration.zip');
            fs.mkdirSync(path.join(remote.dir, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(path.join(remote.dir, rel), pointer);
            commitAll(remote.dir, 'add lfs pointer asset');

            const result = await replaceY3MakerFromRemote(project, remote.url);

            assert.strictEqual(result.ok, true, 'LFS 对象下不来时不该判定为整体失败');
            assert.strictEqual(read(path.join(project.fsPath, '.y3maker', rel)), pointer, '占位指针应原样留下');
            assert.ok(fs.existsSync(path.join(project.fsPath, '.y3maker', 'rules', 'mcp-rules.mdc')), '其他文件照常拉下来');
        });
    });

    suite('后台自动补齐时怎么选来源（手动点击时改由用户自己选，不走这里）', () => {
        suiteTeardown(() => {
            mockEnv.y3RepoUri = undefined;
        });

        test('y3 仓库来自 gitee → 用 gitee 镜像', async () => {
            const project = makeProject();
            const y3Dir = path.join(project.fsPath, 'script', 'y3');
            fs.mkdirSync(y3Dir, { recursive: true });
            git(y3Dir, ['init', '-b', 'main']);
            git(y3Dir, ['remote', 'add', 'origin', 'https://gitee.com/tsukiko/y3-lualib.git']);
            mockEnv.y3RepoUri = vscode.Uri.file(y3Dir);

            assert.ok(detectRepoUrl(project).includes('gitee.com'), 'gitee 来源应命中 gitee 镜像');
        });

        test('y3 仓库来自 github → 用 github', async () => {
            const project = makeProject();
            const y3Dir = path.join(project.fsPath, 'script', 'y3');
            fs.mkdirSync(y3Dir, { recursive: true });
            git(y3Dir, ['init', '-b', 'main']);
            git(y3Dir, ['remote', 'add', 'origin', 'https://github.com/y3-editor/y3-lualib.git']);
            mockEnv.y3RepoUri = vscode.Uri.file(y3Dir);

            assert.ok(!detectRepoUrl(project).includes('gitee'), 'github 来源不该用 gitee 镜像');
        });

        test('y3 文件夹没有 .git → 退回 github（这是已知的隐式行为，改由用户手选后只影响后台路径）', async () => {
            const project = makeProject();
            const y3Dir = path.join(project.fsPath, 'script', 'y3');
            fs.mkdirSync(y3Dir, { recursive: true });
            mockEnv.y3RepoUri = vscode.Uri.file(y3Dir);

            assert.ok(!detectRepoUrl(project).includes('gitee'), '读不到 remote 时应退回 github');
        });
    });

    suite('偏好', () => {
        test('没设置过时的默认值是 ask', async () => {
            const configuration = vscode.workspace.getConfiguration('Y3-Helper');
            await configuration.update('CloneY3MakerConfig', undefined, vscode.ConfigurationTarget.Global);

            assert.strictEqual(
                configuration.inspect('CloneY3MakerConfig')?.defaultValue,
                'ask',
                'package.json 里声明的默认值应该是 ask',
            );
            assert.strictEqual(getCloneY3MakerPreference(), 'ask');
        });

        test('拉取动作本身不会改动偏好（用户的选择只对那一次生效）', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            const dir = makePartial(project);

            const before = getCloneY3MakerPreference();
            await mergeY3MakerFromRemote(project, remote.url);
            await replaceY3MakerFromRemote(project, remote.url);

            assert.strictEqual(getCloneY3MakerPreference(), before, '动作不该替用户改偏好');
            assert.ok(fs.existsSync(path.join(dir, 'rules', 'mcp-rules.mdc')));
        });
    });

    suite('更新检查的门槛', () => {
        test('managed 且与远端一致 → 不提示更新', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            cloneRemoteTo(remote.url, path.join(project.fsPath, '.y3maker'));

            const status = await checkForUpdates(project);

            assert.ok(status, 'managed 应该真的去检查');
            assert.strictEqual(status!.hasUpdate, false);
        });

        test('managed 且落后一个提交 → 提示更新', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            const dir = path.join(project.fsPath, '.y3maker');
            cloneRemoteTo(remote.url, dir);
            git(dir, ['reset', '--hard', 'HEAD~1']);

            const status = await checkForUpdates(project);

            assert.ok(status);
            assert.strictEqual(status!.hasUpdate, true);
            assert.notStrictEqual(status!.localHash, status!.remoteHash);
        });

        test('foreign / partial / missing 一律不检查', async () => {
            const foreignProject = makeProject();
            const foreignDir = path.join(foreignProject.fsPath, '.y3maker');
            fs.mkdirSync(foreignDir, { recursive: true });
            git(foreignDir, ['init', '-b', 'main']);
            git(foreignDir, ['remote', 'add', 'origin', 'https://github.com/someone/other-repo.git']);
            assert.strictEqual(await checkForUpdates(foreignProject), null);

            const partialProject = makeProject();
            makePartial(partialProject);
            assert.strictEqual(await checkForUpdates(partialProject), null);

            const missingProject = makeProject();
            assert.strictEqual(await checkForUpdates(missingProject), null);
        });

        test('偏好为 never 时完全不检查（连 fetch 都不做）', async () => {
            const project = makeProject();
            const remote = makeRemoteRepo();
            const dir = path.join(project.fsPath, '.y3maker');
            cloneRemoteTo(remote.url, dir);
            git(dir, ['reset', '--hard', 'HEAD~1']);
            const fetchHead = path.join(dir, '.git', 'FETCH_HEAD');
            const before = fs.existsSync(fetchHead) ? fs.statSync(fetchHead).mtimeMs : 0;

            const configuration = vscode.workspace.getConfiguration('Y3-Helper');
            await configuration.update('CloneY3MakerConfig', 'never', vscode.ConfigurationTarget.Global);
            try {
                assert.strictEqual(await checkForUpdates(project), null);
                const after = fs.existsSync(fetchHead) ? fs.statSync(fetchHead).mtimeMs : 0;
                assert.strictEqual(after, before, 'never 时不该发生 fetch');
            } finally {
                await configuration.update('CloneY3MakerConfig', undefined, vscode.ConfigurationTarget.Global);
            }
        });
    });
});
