/**
 * 移植自源码版 handlers/workspaceTracker/index.ts
 * 负责追踪工作区内所有文件路径，供 CodeChat 搜索文件时使用
 */
import * as vscode from 'vscode';
import * as path from 'path';

const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0);

function toPosixPath(p: string) {
    const isExtendedLengthPath = p.startsWith('\\\\?\\');
    if (isExtendedLengthPath) {
        return p;
    }
    return p.replace(/\\/g, '/');
}

// 为 String 添加 toPosix 方法（与源码版一致）
declare global {
    interface String {
        toPosix(): string;
    }
}

if (!String.prototype.toPosix) {
    String.prototype.toPosix = function (this: string): string {
        return toPosixPath(this);
    };
}

class WorkspaceTracker {
    private disposables: vscode.Disposable[] = [];
    private filePaths: Set<string> = new Set();

    constructor() {
        this.registerListeners();
    }

    async initializeFilePaths() {
        if (!cwd) {
            return;
        }
        // 获取当前打开的所有文件（与源码版一致）
        const allTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
        for (let i = 0; i < allTabs.length; i++) {
            try {
                const curTab = allTabs[i];
                if ((curTab.input as any)?.uri?.scheme !== 'file') { continue; }
                const uri = (curTab.input as any)?.uri?.path || '';
                if (!uri) { continue; }
                await vscode.workspace.fs.stat(vscode.Uri.file(uri));
                const document = await vscode.workspace.openTextDocument(uri);
                const relativePath = vscode.workspace.asRelativePath(document.uri);
                this.filePaths.add(this.normalizeFilePath(relativePath));
            } catch (e) { }
        }

        // 源码版用 listFilesBfs(cwd, true, 2000)，集成版用 vscode.workspace.findFiles 替代
        try {
            const uris = await vscode.workspace.findFiles(
                '**/*',
                '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/.DS_Store}',
                2000
            );
            for (const uri of uris) {
                const relativePath = vscode.workspace.asRelativePath(uri, false);
                this.filePaths.add(this.normalizeFilePath(relativePath));
            }
        } catch (e) { }
    }

    private registerListeners() {
        const watcher = vscode.workspace.createFileSystemWatcher('**');

        this.disposables.push(
            watcher.onDidCreate(async (uri) => {
                await this.addFilePath(uri.fsPath);
            }),
        );

        this.disposables.push(watcher);
    }

    private normalizeFilePath(filePath: string): string {
        const resolvedPath = cwd ? path.resolve(cwd, filePath) : path.resolve(filePath);
        return filePath.endsWith('/') ? resolvedPath + '/' : resolvedPath;
    }

    private async addFilePath(filePath: string): Promise<string> {
        const normalizedPath = this.normalizeFilePath(filePath);
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(normalizedPath));
            const isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
            const pathWithSlash = isDirectory && !normalizedPath.endsWith('/') ? normalizedPath + '/' : normalizedPath;
            this.filePaths.add(pathWithSlash);
            return pathWithSlash;
        } catch {
            this.filePaths.add(normalizedPath);
            return normalizedPath;
        }
    }

    public activeNewFilePath(filePath: string) {
        const normalizedPath = this.normalizeFilePath(filePath);
        const parts = normalizedPath.split('/');
        for (let i = 0; i < parts.length; i++) {
            const part = parts.slice(0, i + 1).join('/');
            if (i !== parts.length - 1) {
                this.addFilePath(part + '/');
            }
            this.addFilePath(part);
        }
    }

    public async removeFilePath(filePath: string): Promise<boolean> {
        const normalizedPath = this.normalizeFilePath(filePath);
        return this.filePaths.delete(normalizedPath) || this.filePaths.delete(normalizedPath + '/');
    }

    public getFilePaths(option: {
        keyword: string,
        type?: string
    }) {
        const { keyword, type } = option;
        if (cwd) {
            const filePathsArr = Array.from(this.filePaths).map((file) => {
                const relativePath = path.relative(cwd, file).toPosix();
                return file.endsWith('/') ? relativePath + '/' : relativePath;
            });
            return filePathsArr.filter(item => {
                let match = true;
                if (item.endsWith('.c')) {
                    return false;
                }
                if (keyword) {
                    if (!item.toLowerCase().includes(keyword.toLowerCase())) {
                        match = false;
                    }
                }
                if (type === 'file') {
                    if (item.endsWith('/')) {
                        match = false;
                    }
                } else if (type === 'folder') {
                    if (!item.endsWith('/')) {
                        match = false;
                    }
                }
                return match;
            });
        } else {
            return [];
        }
    }

    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
}

let workspaceTracker: WorkspaceTracker | null = null;

export function getWorkspaceTracker() {
    if (!workspaceTracker) {
        workspaceTracker = new WorkspaceTracker();
    }
    return workspaceTracker;
}

export function initWorkspaceTracker() {
    workspaceTracker = new WorkspaceTracker();
    workspaceTracker.initializeFilePaths();
}

export default WorkspaceTracker;
