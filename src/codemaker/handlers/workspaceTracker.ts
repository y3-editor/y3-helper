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

    /**
     * 归一化字符串：转为小写并移除分隔符
     */
    private normalize(str: string): string {
        return str.toLowerCase().replace(/[_\-./\\s]/g, '');
    }

    /**
     * 将路径分割成单词（基于分隔符和驼峰命名）
     */
    private splitIntoWords(str: string): string[] {
        const parts = str.split(/[_\-./\\s]+/);
        const words: string[] = [];
        for (const part of parts) {
            if (!part) continue;
            const camelWords = part.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
            words.push(...camelWords.filter(w => w.length > 0));
        }
        return words.map(w => w.toLowerCase());
    }

    /**
     * 模糊匹配算法
     */
    private fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
        const q = query.toLowerCase();
        const t = target.toLowerCase();
        const nq = this.normalize(query);
        const nt = this.normalize(target);

        // 1. 精确子串匹配（最高分）
        if (t.includes(q)) {
            const index = t.indexOf(q);
            const positionBonus = Math.max(0, 20 - index);
            return { match: true, score: 100 + positionBonus };
        }

        // 2. 去分隔符子串匹配
        if (nt.includes(nq)) {
            const index = nt.indexOf(nq);
            const positionBonus = Math.max(0, 15 - index);
            return { match: true, score: 80 + positionBonus };
        }

        // 3. 单词边界匹配
        const words = this.splitIntoWords(target);
        const normalizedWords = words.map(w => this.normalize(w));

        for (let i = 0; i < words.length; i++) {
            if (words[i] === q || normalizedWords[i] === nq) {
                return { match: true, score: 75 };
            }
        }

        // 3.2 连续单词组合匹配
        const joinedWords = normalizedWords.join('');
        if (joinedWords.includes(nq)) {
            let currentPos = 0;
            let matchedWords = 0;
            for (const word of normalizedWords) {
                const wordInQuery = nq.substring(currentPos, currentPos + word.length);
                if (word === wordInQuery) {
                    currentPos += word.length;
                    matchedWords++;
                }
                if (currentPos >= nq.length) break;
            }
            if (currentPos >= nq.length && matchedWords > 1) {
                return { match: true, score: 70 };
            }
        }

        // 4. 首字母缩写匹配
        const initials = words.map(w => w[0]).join('');
        if (initials.includes(q)) {
            return { match: true, score: 60 };
        }

        // 5. 子序列匹配
        let qi = 0;
        let lastMatchIndex = -1;
        let consecutiveMatches = 0;
        let maxConsecutive = 0;

        for (let ti = 0; ti < nt.length && qi < nq.length; ti++) {
            if (nq[qi] === nt[ti]) {
                if (ti === lastMatchIndex + 1) {
                    consecutiveMatches++;
                } else {
                    maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
                    consecutiveMatches = 1;
                }
                lastMatchIndex = ti;
                qi++;
            }
        }
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);

        if (qi === nq.length) {
            const continuityBonus = Math.min(20, maxConsecutive * 2);
            return { match: true, score: 40 + continuityBonus };
        }

        return { match: false, score: 0 };
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

            // 使用模糊匹配并按分数排序
            const matchedFiles = filePathsArr
                .map(item => {
                    let match = true;
                    let score = 0;

                    if (item.endsWith('.c')) {
                        return null;
                    }

                    if (keyword) {
                        const fuzzyResult = this.fuzzyMatch(keyword, item);
                        if (!fuzzyResult.match) {
                            match = false;
                        } else {
                            score = fuzzyResult.score;
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

                    return match ? { path: item, score } : null;
                })
                .filter((item): item is { path: string; score: number } => item !== null)
                .sort((a, b) => b.score - a.score)
                .map(item => item.path);

            return matchedFiles;
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
