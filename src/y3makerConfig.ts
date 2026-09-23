import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as l10n from '@vscode/l10n';
import { env } from './env';
import { runShell } from './runShell';
import * as y3 from 'y3-helper';
import { disposeMcpHub } from './codemaker/mcpHandlers';
import SkillsHandler from './codemaker/skillsHandler';

// ─── 仓库地址 ────────────────────────────────────────────────

const REPO_URLS = {
    github: 'https://github.com/y3-editor/y3-maker-config.git',
    gitee: 'https://gitee.com/shuizhisu/y3-maker-config.git',
};

/**
 * 根据来源返回 y3-maker-config 仓库地址
 */
export function getConfigRepoUrl(source: 'github' | 'gitee'): string {
    return REPO_URLS[source];
}

// ─── 拉取偏好 ────────────────────────────────────────────────

/**
 * `.y3maker` 拉取偏好：
 * - ask：默认值。只有用户主动初始化项目时弹窗询问一次，弹窗里的选择不改这里
 * - always：自动拉取/恢复
 * - never：完全不碰，也不联网检查更新
 */
export type CloneY3MakerPreference = 'ask' | 'always' | 'never';

const CLONE_PREFERENCE_KEY = 'CloneY3MakerConfig';

export function getCloneY3MakerPreference(): CloneY3MakerPreference {
    const value = vscode.workspace.getConfiguration('Y3-Helper').get<string>(CLONE_PREFERENCE_KEY);
    if (value === 'always' || value === 'never') {
        return value;
    }
    return 'ask';
}

/**
 * `.y3maker` 目录的四种状态。判据是“这个目录能不能被我们安全接管”，
 * 而不是单纯的“有没有 .git”：
 * - managed：是 git 仓库，且 origin 指向 y3-maker-config（我们 clone 的）
 * - foreign：是 git 仓库但 origin 不是我们的（用户自己的仓库 / 自己 git init），永不自动碰
 * - partial：目录存在但没有 .git（面板写的 skills/rules/mcp_settings.json、失败初始化的残留）
 * - missing：目录不存在，可以安全 clone
 */
export type Y3MakerDirState = 'managed' | 'foreign' | 'partial' | 'missing';

/** y3-maker-config 仓库在 URL 里的路径片段，用来判断 .git 到底指向谁 */
const Y3MAKER_REPO_PATH = '/y3-maker-config';

function isOurRepoUrl(url: string): boolean {
    return url.trim()
        // Windows 本地路径形式的 remote（C:\repos\y3-maker-config）也认
        .replace(/\\/g, '/')
        .replace(/\.git$/i, '')
        .replace(/\/+$/, '')
        .toLowerCase()
        .endsWith(Y3MAKER_REPO_PATH);
}

export async function getY3MakerDirState(projectUri: vscode.Uri): Promise<Y3MakerDirState> {
    const y3makerUri = vscode.Uri.joinPath(projectUri, '.y3maker');
    try {
        await vscode.workspace.fs.stat(y3makerUri);
    } catch {
        return 'missing';
    }

    let gitType: vscode.FileType;
    try {
        gitType = (await vscode.workspace.fs.stat(vscode.Uri.joinPath(y3makerUri, '.git'))).type;
    } catch {
        return 'partial';
    }
    if (gitType !== vscode.FileType.Directory) {
        // .git 是文件（gitfile / submodule / worktree），不是我们 clone 出来的形态
        return 'foreign';
    }

    const remote = await execGit(['remote', 'get-url', 'origin'], y3makerUri.fsPath);
    return remote.exitCode === 0 && isOurRepoUrl(remote.stdout) ? 'managed' : 'foreign';
}

/**
 * 列出 `.y3maker` 的顶层条目，用于在覆盖前把“这里面到底有什么”告诉用户。
 */
export async function listY3MakerEntries(projectUri: vscode.Uri): Promise<string[]> {
    try {
        const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.joinPath(projectUri, '.y3maker'));
        return entries
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, type]) => type === vscode.FileType.Directory ? `${name}/` : name);
    } catch {
        return [];
    }
}

// ─── 更新状态缓存 ────────────────────────────────────────────

export interface UpdateStatus {
    hasUpdate: boolean;
    localHash: string;
    remoteHash: string;
}

let _cachedStatus: UpdateStatus | null = null;

export function getCachedUpdateStatus(): UpdateStatus | null {
    return _cachedStatus;
}

export function clearCachedUpdateStatus(): void {
    _cachedStatus = null;
}

// ─── Git 辅助 ────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;

function execGit(
    args: string[],
    cwd: string,
    timeoutMs?: number,
    extraEnv?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
        const options: cp.ExecFileOptions = {
            cwd,
            timeout: timeoutMs,
            windowsHide: true,
            encoding: 'utf8',
        };
        if (extraEnv) {
            options.env = { ...process.env, ...extraEnv };
        }
        const proc = cp.execFile('git', args, options, (error, stdout, stderr) => {
            resolve({
                stdout: String(stdout ?? '').trim(),
                stderr: String(stderr ?? '').trim(),
                exitCode: error ? (error as any).code ?? 1 : 0,
            });
        });
    });
}

/**
 * 从 git 输出里挑出最值得看的一行：进度信息会刷屏，真正的原因在 error/fatal/remote 行。
 */
function describeGitOutput(output: string): string {
    const lines = output.split('\n').map((line) => line.trim()).filter((line) => line !== '');
    return lines.find((line) => /^(error|fatal|remote:|warning:)/i.test(line))
        ?? lines[lines.length - 1]
        ?? '';
}

// ─── 拉取动作 ────────────────────────────────────────────────

const CLONE_TIMEOUT_MS = 120_000;

/** 先克隆到这个临时目录，成功了再换进 .y3maker；失败时项目里的东西一点没动 */
const STAGING_DIR_NAME = '.y3maker.staging';

export interface Y3MakerPullResult {
    ok: boolean;
    /** 备份目录名，只有“备份并替换”会产生 */
    backupDir?: string;
}

async function dirExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

/**
 * 把目录内容逐个移动过去。顶层目录本身可能被 VSCode 监听/占用而移不动，
 * 但它的子项可以。
 */
async function moveDirContents(srcDir: vscode.Uri, dstDir: vscode.Uri): Promise<void> {
    await vscode.workspace.fs.createDirectory(dstDir);
    for (const [name] of await vscode.workspace.fs.readDirectory(srcDir)) {
        await vscode.workspace.fs.rename(
            vscode.Uri.joinPath(srcDir, name),
            vscode.Uri.joinPath(dstDir, name),
            { overwrite: true },
        );
    }
}

/**
 * 时间戳备份目录名：每次备份都是新的一份，绝不抹掉上一代备份。
 * 时间戳只精确到秒，所以同一秒内连续备份时自动加序号。
 */
async function pickBackupDirName(projectUri: vscode.Uri): Promise<string> {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    for (let index = 1; ; index++) {
        const name = index === 1 ? `.y3maker.bak-${stamp}` : `.y3maker.bak-${stamp}-${index}`;
        if (!await dirExists(vscode.Uri.joinPath(projectUri, name))) {
            return name;
        }
    }
}

/** 不下载 LFS 对象，只把工作区补成占位指针文件 */
const SKIP_LFS_ENV: Record<string, string> = {
    GIT_LFS_SKIP_SMUDGE: '1',
};

/** 克隆到临时目录；失败返回 undefined，且不触碰项目里的任何东西 */
async function cloneToStaging(projectUri: vscode.Uri, repoUrl: string): Promise<vscode.Uri | undefined> {
    const stagingUri = vscode.Uri.joinPath(projectUri, STAGING_DIR_NAME);
    try {
        await vscode.workspace.fs.delete(stagingUri, { recursive: true });
    } catch { }

    // 用 VS Code 任务来跑：终端里能看到 git 的实时进度（和初始化 y3-lualib 一样），
    // 出问题时那段红色报错也在那里，便于用户直接复制。
    // 注意：任务只回传退出码，拿不到 stderr，所以这里不再把 git 原文写进日志。
    const exitCode = await runShell(l10n.t('拉取 Y3Maker 配置'), 'git', [
        'clone',
        repoUrl,
        stagingUri.fsPath,
    ]);

    // 但不能只看退出码：只要检出阶段有任何一步失败（远端用了 LFS 而托管方不给下、
    // 文件路径不合法……），git 都会报 “Clone succeeded, but checkout failed” 并返回非 0——
    // 而仓库其实已经可用了。所以以“暂存目录里到底有没有一个可用仓库”为准。
    // （2026-09 那次 Gitee 拉不到 LFS 大文件就是这个形态；现在远端已经没有大文件了，
    //   但这层容忍对将来任何类似的非致命失败都仍然有用。）
    const head = await execGit(['rev-parse', 'HEAD'], stagingUri.fsPath);
    if (head.exitCode !== 0) {
        y3.log.warn(`拉取 y3-maker-config 失败（git 退出码 ${exitCode ?? '未知'}），详情见终端里的 git 输出`);
        try {
            await vscode.workspace.fs.delete(stagingUri, { recursive: true });
        } catch { }
        return undefined;
    }
    if (exitCode !== 0) {
        y3.log.warn('拉取 y3-maker-config 已成功，但 LFS 资产没下下来（会用占位文件代替）；终端里那段 git 报错就是这个原因');
        // 检出可能没走完，补一次跳过 LFS 的检出，保证工作区里文件是齐的
        const restore = await execGit(['checkout', '--force', 'HEAD', '--', '.'], stagingUri.fsPath, CLONE_TIMEOUT_MS, SKIP_LFS_ENV);
        if (restore.exitCode !== 0) {
            y3.log.warn(`补检出没完全成功: ${describeGitOutput(restore.stderr) || restore.exitCode}`);
        }
    }
    return stagingUri;
}

/**
 * 释放 SkillsHandler 和 McpHub 对 .y3maker 的文件监听。
 * 调用方在改动完成后应调用 reloadCodemakerResources() 让它们重建。
 */
export function releaseY3MakerWatchers(): void {
    try { SkillsHandler.getInstance().dispose(); } catch { }
    try { disposeMcpHub(); } catch { }
}

/**
 * 合并：保留现有文件，只把远端有、本地没有的补进来，然后把这个目录纳入 git 管理
 * （HEAD 指向 origin/main，本地差异会显示成“本地修改”，之后可以正常 pull 更新）。
 */
export async function mergeY3MakerFromRemote(projectUri: vscode.Uri, repoUrl: string): Promise<Y3MakerPullResult> {
    const y3makerUri = vscode.Uri.joinPath(projectUri, '.y3maker');
    const stagingUri = await cloneToStaging(projectUri, repoUrl);
    if (!stagingUri) {
        return { ok: false };
    }

    try {
        // 只补缺失的路径，同名内容保持用户原样
        for (const [name] of await vscode.workspace.fs.readDirectory(stagingUri)) {
            const target = vscode.Uri.joinPath(y3makerUri, name);
            if (await dirExists(target)) {
                continue;
            }
            await vscode.workspace.fs.rename(vscode.Uri.joinPath(stagingUri, name), target, { overwrite: false });
        }
    } catch (error) {
        y3.log.warn(`合并 y3-maker-config 失败: ${String(error)}`);
        try {
            await vscode.workspace.fs.delete(stagingUri, { recursive: true });
        } catch { }
        return { ok: false };
    }
    try {
        await vscode.workspace.fs.delete(stagingUri, { recursive: true });
    } catch { }

    // 纳入 git 管理：init + 指向我们的仓库 + fetch，工作区保持原样
    const dir = y3makerUri.fsPath;
    const initResult = await execGit(['init'], dir);
    const remoteResult = await execGit(['remote', 'add', 'origin', repoUrl], dir);
    const fetchResult = await execGit(['fetch', 'origin'], dir, CLONE_TIMEOUT_MS);
    if (initResult.exitCode === 0 && remoteResult.exitCode === 0 && fetchResult.exitCode === 0) {
        await execGit(['reset', '--mixed', 'origin/main'], dir);
        await execGit(['branch', '-M', 'main'], dir);
        await execGit(['branch', '--set-upstream-to=origin/main', 'main'], dir);
    }

    return { ok: await getY3MakerDirState(projectUri) === 'managed' };
}

/**
 * 备份并替换：整目录按时间戳备份后换成远端的一份。
 * 先克隆到临时目录，确认成功后才动手，所以克隆失败时项目里的东西保持原样。
 */
export async function replaceY3MakerFromRemote(projectUri: vscode.Uri, repoUrl: string): Promise<Y3MakerPullResult> {
    const y3makerUri = vscode.Uri.joinPath(projectUri, '.y3maker');
    const stagingUri = await cloneToStaging(projectUri, repoUrl);
    if (!stagingUri) {
        return { ok: false };
    }

    let backupDir: string | undefined;
    try {
        if (await dirExists(y3makerUri)) {
            backupDir = await pickBackupDirName(projectUri);
            await moveDirContents(y3makerUri, vscode.Uri.joinPath(projectUri, backupDir));
            // 空壳如果删不掉也没关系，新内容照样能写进去
            try {
                await vscode.workspace.fs.delete(y3makerUri, { recursive: false });
            } catch { }
        }
        await moveDirContents(stagingUri, y3makerUri);
    } catch (error) {
        y3.log.warn(`替换 .y3maker 失败: ${String(error)}`);
        try {
            await vscode.workspace.fs.delete(stagingUri, { recursive: true });
        } catch { }
        return { ok: false };
    }
    try {
        await vscode.workspace.fs.delete(stagingUri, { recursive: true });
    } catch { }

    return { ok: await getY3MakerDirState(projectUri) === 'managed', backupDir };
}

/**
 * 目录不存在时补一份。只做增量动作，任何偏好下都安全，所以后台启动可以自动执行；
 * 但仅限已初始化过 Y3 库的项目，避免对新建项目乱 clone。
 * 走的是和主菜单节点同一条路（先克隆到暂存目录再换入），所以同样会在终端里显示进度。
 */
export async function cloneY3MakerIfMissing(projectUri: vscode.Uri): Promise<boolean> {
    if (await getY3MakerDirState(projectUri) !== 'missing') {
        return false;
    }

    const y3Uri = env.y3RepoUri;
    if (!y3Uri) {
        return false;
    }
    try {
        if ((await vscode.workspace.fs.stat(vscode.Uri.joinPath(y3Uri, '.git'))).type !== vscode.FileType.Directory) {
            // y3/.git 存在但不是目录，不视为已初始化
            return false;
        }
    } catch {
        // y3/.git 不存在 → 项目从未初始化，不需要自动 clone .y3maker
        return false;
    }

    const result = await replaceY3MakerFromRemote(projectUri, detectRepoUrl(projectUri));
    if (!result.ok) {
        y3.log.warn('自动补齐 .y3maker 失败，稍后可从主菜单的“Y3Maker 配置未初始化”节点重试');
        return false;
    }
    return true;
}

// ─── 核心功能 ────────────────────────────────────────────────

/**
 * 检测 .y3maker 是否有远端更新。
 * - 如果 .y3maker 不存在或无 .git，返回 null（由调用方决定是否迁移）
 * - fetch 失败（网络不可达等）返回 null
 */
export async function checkForUpdates(projectUri: vscode.Uri): Promise<UpdateStatus | null> {
    // 用户选择“不碰 .y3maker”时不联网检查更新
    if (getCloneY3MakerPreference() === 'never') {
        return null;
    }

    // 只在自己的仓库里检查：别人的仓库、没纳入管理的目录一律不 fetch、也不提示更新
    if (await getY3MakerDirState(projectUri) !== 'managed') {
        return null;
    }

    const y3makerDir = vscode.Uri.joinPath(projectUri, '.y3maker').fsPath;

    // git fetch
    const fetchResult = await execGit(['fetch', 'origin', '--quiet'], y3makerDir, FETCH_TIMEOUT_MS);
    if (fetchResult.exitCode !== 0) {
        // 网络不可达等，静默跳过
        return null;
    }

    // 比较 HEAD vs origin/main
    const localResult = await execGit(['rev-parse', 'HEAD'], y3makerDir);
    const remoteResult = await execGit(['rev-parse', 'origin/main'], y3makerDir);

    if (localResult.exitCode !== 0 || remoteResult.exitCode !== 0) {
        return null;
    }

    const localHash = localResult.stdout;
    const remoteHash = remoteResult.stdout;
    const hasUpdate = localHash !== remoteHash;

    _cachedStatus = { hasUpdate, localHash, remoteHash };
    return _cachedStatus;
}

/**
 * 执行 git pull 更新
 */
export async function performUpdate(projectUri: vscode.Uri): Promise<{ success: boolean; conflict: boolean }> {
    const y3makerDir = vscode.Uri.joinPath(projectUri, '.y3maker').fsPath;

    const result = await execGit(['pull', 'origin', 'main'], y3makerDir);

    if (result.exitCode === 0) {
        return { success: true, conflict: false };
    }

    // 检测冲突
    const hasConflict = result.stdout.includes('CONFLICT') || result.stderr.includes('CONFLICT');
    return { success: false, conflict: hasConflict || true };
}

/**
 * 强制使用远端版本（冲突时）
 */
export async function forceRemoteUpdate(projectUri: vscode.Uri): Promise<void> {
    const y3makerDir = vscode.Uri.joinPath(projectUri, '.y3maker').fsPath;

    await execGit(['merge', '--abort'], y3makerDir);
    await execGit(['reset', '--hard', 'origin/main'], y3makerDir);
}

// ─── 辅助函数 ────────────────────────────────────────────────

/**
 * 根据 y3-lualib 仓库的 remote 地址推断该用哪个镜像，返回 y3-maker-config 的克隆地址
 */
export function detectRepoUrl(projectUri: vscode.Uri): string {
    const y3Dir = env.y3RepoUri?.fsPath;
    if (y3Dir) {
        try {
            const result = cp.execFileSync('git', ['remote', 'get-url', 'origin'], {
                cwd: y3Dir,
                windowsHide: true,
            }).toString().trim();
            if (result.includes('gitee')) {
                return REPO_URLS.gitee;
            }
        } catch {
            // 无法读取 remote，使用默认
        }
    }
    return REPO_URLS.github;
}
