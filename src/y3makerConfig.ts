import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
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

function execGit(args: string[], cwd: string, timeoutMs?: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
        const proc = cp.execFile('git', args, {
            cwd,
            timeout: timeoutMs,
            windowsHide: true,
        }, (error, stdout, stderr) => {
            resolve({
                stdout: (stdout ?? '').trim(),
                stderr: (stderr ?? '').trim(),
                exitCode: error ? (error as any).code ?? 1 : 0,
            });
        });
    });
}

/**
 * 将目录内容移动到备份目录，然后删除空的源目录。
 * 绕过 VSCode 对顶层目录的句柄锁定（子文件/子目录可以移动）。
 */
async function backupDirContents(srcDir: vscode.Uri, bakDir: vscode.Uri): Promise<void> {
    // 确保备份目录存在
    try {
        await vscode.workspace.fs.delete(bakDir, { recursive: true });
    } catch { }
    await vscode.workspace.fs.createDirectory(bakDir);

    // 读取源目录内容，逐个移动到备份目录
    const entries = await vscode.workspace.fs.readDirectory(srcDir);
    for (const [name, type] of entries) {
        const srcEntry = vscode.Uri.joinPath(srcDir, name);
        const bakEntry = vscode.Uri.joinPath(bakDir, name);
        await vscode.workspace.fs.rename(srcEntry, bakEntry, { overwrite: true });
    }

    // 尝试删除空的源目录
    try {
        await vscode.workspace.fs.delete(srcDir, { recursive: false });
    } catch {
        // 空目录如果也删不掉就留着，后续 git clone 会失败，改用 git init 方式
    }
}

// ─── 核心功能 ────────────────────────────────────────────────

/**
 * 检测 .y3maker 是否有远端更新。
 * - 如果 .y3maker 不存在或无 .git，返回 null（由调用方决定是否迁移）
 * - fetch 失败（网络不可达等）返回 null
 */
export async function checkForUpdates(projectUri: vscode.Uri): Promise<UpdateStatus | null> {
    const y3makerDir = vscode.Uri.joinPath(projectUri, '.y3maker').fsPath;
    const gitDir = path.join(y3makerDir, '.git');

    // 检查 .y3maker/.git 是否存在
    try {
        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(gitDir));
        if (stat.type !== vscode.FileType.Directory) {
            return null;
        }
    } catch {
        return null;
    }

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
 * 老用户迁移：.y3maker 存在但无 .git 时，备份并 clone 最新版本。
 * 当 .y3maker 不存在时（用户误删），直接 clone 最新版本。
 */
export async function migrateOldUser(projectUri: vscode.Uri): Promise<boolean> {
    const y3makerUri = vscode.Uri.joinPath(projectUri, '.y3maker');
    const gitUri = vscode.Uri.joinPath(y3makerUri, '.git');

    // 检查 .y3maker 是否存在
    let y3makerExists = false;
    try {
        await vscode.workspace.fs.stat(y3makerUri);
        y3makerExists = true;
    } catch {
        // .y3maker 不存在
    }

    if (y3makerExists) {
        // 检查 .git 是否存在
        try {
            await vscode.workspace.fs.stat(gitUri);
            // .git 存在，已是正常的 git 仓库，无需迁移
            return false;
        } catch {
            // .git 不存在，需要迁移
        }

        // 释放 SkillsHandler 和 McpHub 对 .y3maker 目录的文件监听
        try { SkillsHandler.getInstance().dispose(); } catch { }
        try { disposeMcpHub(); } catch { }

        // 备份：将 .y3maker 内容移动到 .y3maker.bak，绕过 VSCode 对顶层目录的句柄锁定
        const bakUri = vscode.Uri.joinPath(projectUri, '.y3maker.bak');
        await backupDirContents(y3makerUri, bakUri);

        // 检查 .y3maker 是否已被成功删除
        let srcDirDeleted = false;
        try {
            await vscode.workspace.fs.stat(y3makerUri);
        } catch {
            srcDirDeleted = true;
        }

        const repoUrl = detectRepoSource(projectUri);
        if (srcDirDeleted) {
            // 目录已删除，直接 clone
            await runShell('克隆 Y3Maker 配置', 'git', [
                'clone',
                repoUrl,
                y3makerUri.fsPath,
            ]);
        } else {
            // 空目录删不掉（VSCode 句柄），就地 git init
            await execGit(['init'], y3makerUri.fsPath);
            await execGit(['remote', 'add', 'origin', repoUrl], y3makerUri.fsPath);
            const fetchResult = await execGit(['fetch', 'origin'], y3makerUri.fsPath, 30_000);
            if (fetchResult.exitCode !== 0) {
                return false;
            }
            await execGit(['reset', '--hard', 'origin/main'], y3makerUri.fsPath);
            await execGit(['branch', '-M', 'main'], y3makerUri.fsPath);
            await execGit(['branch', '--set-upstream-to=origin/main', 'main'], y3makerUri.fsPath);
        }

        return true;
    }

    // .y3maker 不存在（用户误删），直接 clone
    const repoUrl = detectRepoSource(projectUri);
    await runShell('克隆 Y3Maker 配置', 'git', [
        'clone',
        repoUrl,
        y3makerUri.fsPath,
    ]);

    return true;
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
 * 根据 y3-lualib 仓库的 remote 地址推断来源（github / gitee）
 */
function detectRepoSource(projectUri: vscode.Uri): string {
    const y3Dir = env.y3Uri?.fsPath;
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