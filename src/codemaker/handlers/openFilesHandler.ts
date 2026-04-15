/**
 * 移植自源码版 handlers/openFilesHandler.ts
 * 记录最近打开的文件，供 CodeChat @ 面板使用
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { getWorkspaceTracker } from './workspaceTracker';

export interface OpenFile {
    name: string;
    mtime: number;
    document: vscode.TextDocument;
    notebook?: vscode.NotebookDocument;
    isNoteBook?: boolean;
}

const MAX_FILE_RECORD_COUNT = 20;
const MAX_FILE_LENGTH = 50000;

let openFilesHandler: OpenFilesHandler | null = null;

/**
 * 简化版 getDocumentLanguage（移植自源码版 utils/getDocumentLanguage.ts）
 */
function getDocumentLanguage(language: string): string {
    let lang = '';
    switch (language) {
        case 'javascriptreact':
            lang = 'jsx';
            break;
        case 'typescriptreact':
            lang = 'tsx';
            break;
        case 'shellscript':
            lang = 'shell';
            break;
        default:
            lang = language;
    }
    return lang.toLowerCase();
}

export class OpenFilesHandler {
    private extensionContext: vscode.ExtensionContext;
    private workspaceRootPath: string;
    private recentOpenFiles: {
        [propName: string]: OpenFile[];
    };
    private dispose: vscode.Disposable | null = null;
    private disposeNotebook: vscode.Disposable | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.extensionContext = context;
        this.workspaceRootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        this.recentOpenFiles = {};
        this.initRecentOpenFiles();
    }

    private initRecentOpenFiles() {
        // 从缓存中同步最近打开的文件
        if (this.extensionContext && this.workspaceRootPath) {
            const cacheOpenFiles: {
                [propName: string]: {
                    [propName: string]: OpenFile[];
                };
            } = this.extensionContext.globalState.get('recentOpenFiles') || {};
            const workspaceOpenFiles = cacheOpenFiles[this.workspaceRootPath] || {};
            const langs = Object.keys(workspaceOpenFiles);
            for (const lang of langs) {
                (workspaceOpenFiles[lang] || []).forEach((file) => {
                    if (file.isNoteBook) {
                        vscode.workspace
                            .openNotebookDocument(vscode.Uri.file(file.document.fileName))
                            .then((notebook) => {
                                if (notebook) {
                                    const newFile = {
                                        ...file,
                                        notebook: notebook,
                                    };
                                    this.recentOpenFiles[lang] = this.recentOpenFiles[lang] || [];
                                    const fileList = this.recentOpenFiles[lang];
                                    const index = fileList.findIndex(
                                        (item) => item.name === newFile.name
                                    );
                                    if (index !== -1) {
                                        fileList.splice(index, 1);
                                    }
                                    fileList.unshift(newFile);
                                    if (fileList.length > MAX_FILE_RECORD_COUNT) {
                                        fileList.sort((a, b) => b.mtime - a.mtime);
                                        fileList.pop();
                                    }
                                }
                            });
                    } else {
                        vscode.workspace
                            .openTextDocument(vscode.Uri.file(file.document.fileName))
                            .then((doc) => {
                                if (doc) {
                                    const newFile = {
                                        ...file,
                                        document: doc,
                                    };
                                    this.recentOpenFiles[lang] = this.recentOpenFiles[lang] || [];
                                    const fileList = this.recentOpenFiles[lang];
                                    const index = fileList.findIndex(
                                        (item) => item.name === newFile.name
                                    );
                                    if (index !== -1) {
                                        fileList.splice(index, 1);
                                    }
                                    fileList.unshift(newFile);
                                    if (fileList.length > MAX_FILE_RECORD_COUNT) {
                                        fileList.sort((a, b) => b.mtime - a.mtime);
                                        fileList.pop();
                                    }
                                }
                            });
                    }
                });
            }
        }
        // 获取当前打开的所有文件
        const openFiles = vscode.workspace.textDocuments;
        const openNotebookFiles = vscode.workspace.notebookDocuments;
        openFiles.forEach((file) => {
            if (file.fileName.endsWith('.h')) {
                this.addRecentOpenFiles({ name: file.fileName, mtime: new Date().getTime(), document: file }, 'c');
                this.addRecentOpenFiles({ name: file.fileName, mtime: new Date().getTime(), document: file }, 'lpc');
                this.addRecentOpenFiles({ name: file.fileName, mtime: new Date().getTime(), document: file }, 'cpp');
            } else {
                this.addRecentOpenFiles({ name: file.fileName, mtime: new Date().getTime(), document: file }, file.languageId);
            }
        });
        openNotebookFiles.forEach((file) => {
            const fileName = file.uri.fsPath;
            this.addRecentOpenFiles(
                { name: fileName, mtime: new Date().getTime(), document: file.cellAt(0).document, notebook: file, isNoteBook: true },
                file.cellAt(0).document.languageId,
                true
            );
        });
        this.disposeRecentOpenFiles();
        this.dispose = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                const fileName = editor.document.fileName;
                if (editor.document.fileName.endsWith('.h')) {
                    this.addRecentOpenFiles({ name: fileName, mtime: new Date().getTime(), document: editor.document }, 'c');
                    this.addRecentOpenFiles({ name: fileName, mtime: new Date().getTime(), document: editor.document }, 'cpp');
                    this.addRecentOpenFiles({ name: fileName, mtime: new Date().getTime(), document: editor.document }, 'lpc');
                } else {
                    this.addRecentOpenFiles({ name: fileName, mtime: new Date().getTime(), document: editor.document }, editor.document.languageId);
                }
                // 记录到 workspaceTracker，CodeChat搜索文件时用
                const workspaceTracker = getWorkspaceTracker();
                workspaceTracker.activeNewFilePath(fileName);
            }
        });
        this.disposeNotebook = vscode.window.onDidChangeActiveNotebookEditor(
            (notebookEditor) => {
                if (notebookEditor) {
                    const fileName = notebookEditor.notebook.uri.fsPath;
                    this.addRecentOpenFiles(
                        { name: fileName, mtime: new Date().getTime(), document: notebookEditor.notebook.cellAt(0).document, notebook: notebookEditor.notebook, isNoteBook: true },
                        notebookEditor.notebook.cellAt(0).document.languageId
                    );
                }
            }
        );
    }

    public addRecentOpenFiles(file: OpenFile, lang: string, isNoteBook?: boolean) {
        const language = getDocumentLanguage(lang);
        // 仅记录当前工作空间中有的文件
        if (file.name.indexOf(this.workspaceRootPath) === -1) {
            return;
        }
        this.recentOpenFiles[language] = this.recentOpenFiles[language] || [];
        const fileList = this.recentOpenFiles[language];
        const index = fileList.findIndex((item) => item.name === file.name);
        if (index !== -1) {
            if (fileList[index].isNoteBook && !isNoteBook) {
                return;
            }
            fileList.splice(index, 1);
        }
        fileList.unshift(file);
        if (fileList.length > MAX_FILE_RECORD_COUNT) {
            fileList.sort((a, b) => b.mtime - a.mtime);
            fileList.pop();
        }
        // 同步到 GlobalState 缓存
        const cacheOpenFiles: {
            [propName: string]: {
                [propName: string]: OpenFile[];
            };
        } = this.extensionContext.globalState.get('recentOpenFiles') || {};
        cacheOpenFiles[this.workspaceRootPath] = this.recentOpenFiles;
        this.extensionContext.globalState.update('recentOpenFiles', cacheOpenFiles);
    }

    public clearRecentOpenFiles() {
        this.recentOpenFiles = {};
        this.extensionContext.globalState.update('recentOpenFiles', {});
    }

    public getRecentOpenFiles(lang: string) {
        const language = getDocumentLanguage(lang);
        let result = this.recentOpenFiles[language] || [];
        if (language === 'tsx' || language === 'typescript') {
            result = (this.recentOpenFiles['typescript'] || []).concat(
                this.recentOpenFiles['tsx'] || []
            );
            result.sort((a, b) => b.mtime - a.mtime);
            result = result.slice(0, 10);
        } else if (language === 'jsx' || language === 'javascript') {
            result = (this.recentOpenFiles['javascript'] || []).concat(
                this.recentOpenFiles['jsx'] || []
            );
            result.sort((a, b) => b.mtime - a.mtime);
            result = result.slice(0, 10);
        }

        return result.map((item) => {
            let fileContent = '';
            if (item.isNoteBook && item.notebook) {
                fileContent = '';
                item.notebook.getCells().forEach((cell: vscode.NotebookCell) => {
                    fileContent += `${cell.document.getText()}\n\n`;
                });
            } else {
                fileContent = item.document.getText();
            }
            if (fileContent.length > MAX_FILE_LENGTH) {
                fileContent = fileContent.substring(0, MAX_FILE_LENGTH);
            }
            return {
                name: item.name,
                relative_path: vscode.workspace.asRelativePath(item.name),
                mtime: item.mtime,
                content: fileContent.replace(/\r\n/g, '\n'),
            };
        });
    }

    // 获取最近打开Top N的文件（与源码版一致）
    public getRecentlyOpenedTop(count: number) {
        let allFiles: OpenFile[] = [];
        const ignoreSubfix = ['.git'];

        Object.keys(this.recentOpenFiles).forEach(language => {
            allFiles = allFiles.concat(this.recentOpenFiles[language] || []);
        });

        allFiles.sort((a, b) => b.mtime - a.mtime);

        const uniqueFiles: OpenFile[] = [];
        const fileNames = new Set();
        for (const file of allFiles) {
            if (ignoreSubfix.some(subfix => file.name.endsWith(subfix))) {
                continue;
            }
            if (!fileNames.has(file.name)) {
                fileNames.add(file.name);
                uniqueFiles.push(file);
                if (uniqueFiles.length >= count) {
                    break;
                }
            }
        }

        return uniqueFiles.map(item => {
            let fileContent = '';
            if (item.isNoteBook && item.notebook) {
                fileContent = '';
                item.notebook.getCells().forEach((cell: vscode.NotebookCell) => {
                    fileContent += `${cell.document.getText()}\n\n`;
                });
            } else {
                fileContent = item.document.getText();
            }
            if (fileContent.length > MAX_FILE_LENGTH) {
                fileContent = fileContent.substring(0, MAX_FILE_LENGTH);
            }
            const relativePath = vscode.workspace.asRelativePath(item.name);
            return {
                name: item.name,
                fileName: path.basename(relativePath),
                relative_path: relativePath,
                path: relativePath,
                mtime: item.mtime,
                content: fileContent.replace(/\r\n/g, '\n'),
                isActive: false,
            };
        });
    }

    public disposeRecentOpenFiles() {
        if (this.dispose) {
            this.dispose.dispose();
        }
        if (this.disposeNotebook) {
            this.disposeNotebook.dispose();
        }
    }
}

export function initOpenFilesHandler(context: vscode.ExtensionContext) {
    openFilesHandler = new OpenFilesHandler(context);
}

export function getOpenFilesHandler() {
    return openFilesHandler;
}
