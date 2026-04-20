import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { env } from './env';
import { runShell } from './runShell';
import * as y3 from 'y3-helper';

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
 * 老用户迁移：.y3maker 存在但无 .git 时，备份并 clone 最新版本
 */
export async function migrateOldUser(projectUri: vscode.Uri): Promise<boolean> {
    const y3makerUri = vscode.Uri.joinPath(projectUri, '.y3maker');
    const gitUri = vscode.Uri.joinPath(y3makerUri, '.git');

    // 检查 .y3maker 是否存在
    try {
        await vscode.workspace.fs.stat(y3makerUri);
    } catch {
        // .y3maker 不存在，无需迁移
        return false;
    }

    // 检查 .git 是否存在
    try {
        await vscode.workspace.fs.stat(gitUri);
        // .git 存在，不是老用户
        return false;
    } catch {
        // .git 不存在，需要迁移
    }

    // 备份 .y3maker → .y3maker.bak（已有则覆盖）
    const bakUri = vscode.Uri.joinPath(projectUri, '.y3maker.bak');
    try {
        await vscode.workspace.fs.delete(bakUri, { recursive: true });
    } catch {
        // .y3maker.bak 不存在，忽略
    }
    await vscode.workspace.fs.rename(y3makerUri, bakUri, { overwrite: true });

    // clone 最新 y3-maker-config
    const repoUrl = detectRepoSource(projectUri);
    await runShell('克隆 Y3Maker 配置', 'git', [
        'clone',
        repoUrl,
        y3makerUri.fsPath,
    ]);

    y3.log.info('老用户 .y3maker 已迁移：备份至 .y3maker.bak，已 clone 最新配置');
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
