import * as vscode from 'vscode';
import * as path from 'path';
import { execGit } from './tools/git';
import { moveDirContents } from './tools/fs';

/**
 * Y3 库（y3-lualib）的初始化。
 *
 * 硬性约束：任何会动到磁盘的动作都必须排在用户确认之后。
 * 历史实现先删旧目录再弹来源选择，用户点取消时文件已经被移进回收站。
 */

export type Y3LibraryRepoSource = 'github' | 'gitee' | 'legacy';

export const Y3_LIBRARY_REPO_URLS: Record<Y3LibraryRepoSource, string> = {
    github: 'https://github.com/y3-editor/y3-lualib.git',
    gitee: 'https://gitee.com/tsukiko/y3-lualib.git',
    legacy: 'https://github.com/CliCli-Editor/lualib.git',
};

/** 官方仓库名，用来判断目录是不是本工具拉下来的 */
const OWNED_REPO_NAMES = new Set(['y3-lualib', 'lualib']);

export function isOwnedY3LibraryRepoUrl(url: string): boolean {
    const name = url.trim()
        .replace(/\\/g, '/')
        .replace(/\/+$/, '')
        .replace(/\.git$/i, '')
        .split('/')
        .pop()
        ?.toLowerCase();
    return name !== undefined && OWNED_REPO_NAMES.has(name);
}

/**
 * - missing：目录不存在，可以直接 clone
 * - initialized：`.git` 是目录，属于已有 git 仓库，绝不碰（用户自己的 fork 也算）
 * - unmanaged：目录存在但没有 `.git`（拷贝版、SVN、`.git` 是文件的 worktree……）
 * - occupied：路径被文件占用
 */
export type Y3LibraryDirState = 'missing' | 'initialized' | 'unmanaged' | 'occupied';

export type Y3LibraryUnmanagedAction = 'backup' | 'cancel';

export interface Y3LibraryInitPrompts {
    askRepoSource(): Promise<'github' | 'gitee' | undefined>;
    askUnmanagedAction(y3Uri: vscode.Uri, entries: string[]): Promise<Y3LibraryUnmanagedAction>;
}

export interface Y3LibraryInitOptions {
    /** 备份目录挂在项目根目录下 */
    projectUri: vscode.Uri;
    y3Uri: vscode.Uri;
    prompts: Y3LibraryInitPrompts;
    /** 执行 clone，返回 git 退出码 */
    clone(source: Y3LibraryRepoSource): Promise<number | undefined>;
    /** 非中文环境没有来源选择，直接用它 */
    fixedSource?: Y3LibraryRepoSource;
}

export type Y3LibraryInitResult =
    | { status: 'canceled'; canceledAt: 'source' | 'unmanaged' }
    | { status: 'initialized' }
    | { status: 'occupied' }
    | { status: 'backup-failed'; backupUri?: vscode.Uri }
    | { status: 'clone-failed'; restored: boolean; backupUri?: vscode.Uri; exitCode?: number; error?: unknown }
    | { status: 'success'; source: Y3LibraryRepoSource; backupUri?: vscode.Uri };

const BACKUP_ROOT_NAME = '.y3lualib-backup';

async function statType(uri: vscode.Uri): Promise<vscode.FileType | undefined> {
    try {
        return (await vscode.workspace.fs.stat(uri)).type;
    } catch {
        return undefined;
    }
}

async function y3LibraryPathExists(uri: vscode.Uri): Promise<boolean> {
    return await statType(uri) !== undefined;
}

async function hasGitDirectory(uri: vscode.Uri): Promise<boolean> {
    return await statType(vscode.Uri.joinPath(uri, '.git')) === vscode.FileType.Directory;
}

export async function getY3LibraryDirState(y3Uri: vscode.Uri): Promise<Y3LibraryDirState> {
    const type = await statType(y3Uri);
    if (type === undefined) {
        return 'missing';
    }
    if (type !== vscode.FileType.Directory) {
        return 'occupied';
    }
    // `.git` 是目录就当作“已经初始化过”，不管 remote 指向哪里：用户自己的仓库也不碰
    return await hasGitDirectory(y3Uri) ? 'initialized' : 'unmanaged';
}

/**
 * 是否已经由本工具初始化过。
 * 侧边栏入口的显示条件和初始化命令的早退条件必须用同一个判据，否则会出现
 * “入口看不见但命令其实还能用”或“入口在、点了却提示已初始化”的不一致。
 */
export async function isY3LibraryInitialized(y3Uri: vscode.Uri): Promise<boolean> {
    return await getY3LibraryDirState(y3Uri) === 'initialized';
}

/**
 * 目录是不是本工具 clone 下来的 Y3 库：`.git` 是目录，且 origin 指向官方仓库。
 * 用来在“清理地图里的旧副本”前做归属判断，避免删掉用户自己维护的版本。
 */
export async function isManagedY3LibraryRepo(y3Uri: vscode.Uri): Promise<boolean> {
    if (!await hasGitDirectory(y3Uri)) {
        return false;
    }
    const remote = await execGit(['remote', 'get-url', 'origin'], y3Uri.fsPath);
    return remote.exitCode === 0 && isOwnedY3LibraryRepoUrl(remote.stdout);
}

export async function listY3LibraryEntries(y3Uri: vscode.Uri): Promise<string[]> {
    try {
        const entries = await vscode.workspace.fs.readDirectory(y3Uri);
        return entries
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, type]) => type === vscode.FileType.Directory ? `${name}/` : name);
    } catch {
        return [];
    }
}

/** 时间戳备份目录名：每次都是新的一份，同一秒内连续备份时自动加序号 */
async function pickBackupUri(projectUri: vscode.Uri, y3Uri: vscode.Uri): Promise<vscode.Uri> {
    const root = vscode.Uri.joinPath(projectUri, BACKUP_ROOT_NAME);
    await vscode.workspace.fs.createDirectory(root);

    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const base = path.basename(y3Uri.fsPath) || 'y3';

    for (let index = 1; ; index++) {
        const name = index === 1 ? `${base}-${stamp}` : `${base}-${stamp}-${index}`;
        const candidate = vscode.Uri.joinPath(root, name);
        if (!await y3LibraryPathExists(candidate)) {
            return candidate;
        }
    }
}

async function moveDir(srcDir: vscode.Uri, dstDir: vscode.Uri): Promise<void> {
    await moveDirContents(srcDir, dstDir);
    // 空壳删不掉也不影响后续 clone（git 允许 clone 到空目录）
    try {
        await vscode.workspace.fs.delete(srcDir, { recursive: false });
    } catch { }
}

/** clone 是否可用：以“有没有 README”或“是不是一个 git 仓库”为准，兼容 checkout 阶段的非致命失败 */
async function isUsableClone(y3Uri: vscode.Uri): Promise<boolean> {
    if (await statType(vscode.Uri.joinPath(y3Uri, 'README.md')) === vscode.FileType.File) {
        return true;
    }
    const head = await execGit(['rev-parse', 'HEAD'], y3Uri.fsPath);
    return head.exitCode === 0;
}

export async function initY3Library(options: Y3LibraryInitOptions): Promise<Y3LibraryInitResult> {
    const { projectUri, y3Uri, prompts, clone, fixedSource } = options;

    const state = await getY3LibraryDirState(y3Uri);
    if (state === 'initialized') {
        return { status: 'initialized' };
    }
    if (state === 'occupied') {
        return { status: 'occupied' };
    }

    // 先问，问完再动磁盘。取消时这里直接返回，目录一个字节都不会变。
    let source = fixedSource;
    if (!source) {
        source = await prompts.askRepoSource();
        if (!source) {
            return { status: 'canceled', canceledAt: 'source' };
        }
    }

    let backupUri: vscode.Uri | undefined;
    if (state === 'unmanaged') {
        const entries = await listY3LibraryEntries(y3Uri);
        if (entries.length > 0) {
            const action = await prompts.askUnmanagedAction(y3Uri, entries);
            if (action !== 'backup') {
                return { status: 'canceled', canceledAt: 'unmanaged' };
            }
            try {
                backupUri = await pickBackupUri(projectUri, y3Uri);
                await moveDir(y3Uri, backupUri);
            } catch {
                // 已经移过去的项尽量搬回来，避免停在“删了一半”的状态
                if (backupUri) {
                    try { await moveDir(backupUri, y3Uri); } catch { }
                }
                return { status: 'backup-failed', backupUri };
            }
        } else {
            // 空目录没有任何内容会丢，直接清掉给 clone 让位
            try {
                await vscode.workspace.fs.delete(y3Uri, { recursive: false });
            } catch { }
        }
    }

    let exitCode: number | undefined;
    let cloneError: unknown;
    try {
        exitCode = await clone(source);
    } catch (error) {
        // 当作 clone 失败处理，统一走下面的回滚
        cloneError = error;
    }

    if (!await isUsableClone(y3Uri)) {
        // 清掉半成品，再把备份放回去
        if (await y3LibraryPathExists(y3Uri)) {
            try { await vscode.workspace.fs.delete(y3Uri, { recursive: true }); } catch { }
        }
        let restored = false;
        if (backupUri) {
            try {
                await moveDir(backupUri, y3Uri);
                restored = true;
            } catch { }
        }
        return { status: 'clone-failed', restored, backupUri, exitCode, error: cloneError };
    }

    return { status: 'success', source, backupUri };
}
