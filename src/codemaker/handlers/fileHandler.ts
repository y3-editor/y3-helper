/**
 * 文件操作 Handler
 * - OPEN_FILE
 * - CREATE_FILE_AND_INSERT_CODE
 * - EXPORT_FILE
 * - LOAD_DIRECTORY_FILES
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

function findLineNumber(
    document: vscode.TextDocument,
    searchText: string,
    startLine: number = 0
): number {
    if (!searchText || !searchText.trim()) { return -1; }
    const trimmed = searchText.trim();
    for (let i = startLine; i < document.lineCount; i++) {
        if (document.lineAt(i).text.includes(trimmed)) {
            return i;
        }
    }
    return -1;
}

export async function handleOpenFile(data: any) {
    const { filePath, code, startLine, endLine } = data;
    let openFilePath = filePath;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!path.isAbsolute(openFilePath) && workspaceFolder) {
        openFilePath = path.join(workspaceFolder.uri.fsPath, filePath);
    }

    try {
        if (!fs.existsSync(openFilePath)) {
            vscode.window.showInformationMessage(`未找到该文件: ${openFilePath}`);
            return;
        }
        const targetDocument = await vscode.workspace.openTextDocument(openFilePath);
        const targetEditor = await vscode.window.showTextDocument(targetDocument);

        if (typeof startLine === 'number' && startLine >= 0) {
            const locateStart = startLine > 0 ? startLine - 1 : 0;
            const locateEnd = typeof endLine === 'number' && endLine >= startLine
                ? endLine - 1 : locateStart;
            const maxLine = targetDocument.lineCount - 1;
            const safeStart = Math.min(locateStart, maxLine);
            const safeEnd = Math.min(locateEnd, maxLine);

            targetEditor.selection = new vscode.Selection(
                new vscode.Position(safeStart, 0),
                new vscode.Position(safeEnd, targetDocument.lineAt(safeEnd).text.length)
            );
            targetEditor.revealRange(
                targetEditor.selection,
                vscode.TextEditorRevealType.InCenter
            );
        } else if (code) {
            const codeLines = code.split('\n');
            let locateStart = findLineNumber(targetDocument, codeLines[0]);
            if (locateStart < 0 && codeLines[1]) {
                locateStart = findLineNumber(targetDocument, codeLines[1]);
            }
            if (locateStart < 0) { locateStart = 0; }
            let locateEnd = findLineNumber(
                targetDocument, codeLines[codeLines.length - 1], locateStart
            );
            if (locateEnd < 0) { locateEnd = locateStart; }

            targetEditor.selection = new vscode.Selection(
                new vscode.Position(locateStart, 0),
                new vscode.Position(locateEnd,
                    targetDocument.lineAt(locateEnd).text.length)
            );
            targetEditor.revealRange(
                targetEditor.selection,
                vscode.TextEditorRevealType.InCenter
            );
        }
    } catch (err: any) {
        vscode.window.showErrorMessage(`未能打开文件: ${openFilePath}`);
        console.error('[Y3Maker] OPEN_FILE error:', err);
    }
}

export async function handleCreateFile(data: any) {
    const { language, content, filePath } = data;
    try {
        if (filePath) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('No workspace folder is opened');
                return;
            }
            const fileUri = vscode.Uri.file(
                path.isAbsolute(filePath)
                    ? filePath
                    : path.join(workspaceRoot.fsPath, filePath)
            );
            try {
                await vscode.workspace.fs.stat(fileUri);
                vscode.window.showInformationMessage(
                    `File already exists: ${fileUri.fsPath}`
                );
            } catch {
                await vscode.workspace.fs.createDirectory(
                    vscode.Uri.file(path.dirname(fileUri.fsPath))
                );
                await vscode.workspace.fs.writeFile(
                    fileUri,
                    new Uint8Array(Buffer.from(content, 'utf8'))
                );
                vscode.window.showInformationMessage(
                    `File created: ${fileUri.fsPath}`
                );
                const document = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(document);
            }
        } else {
            const document = await vscode.workspace.openTextDocument({
                language, content,
            });
            await vscode.window.showTextDocument(document);
        }
    } catch (error) {
        console.error('[Y3Maker] CREATE_FILE_AND_INSERT_CODE error:', error);
    }
}

export async function handleExportFile(data: any) {
    try {
        const { filename, content } = data;
        const saveDialogOptions: vscode.SaveDialogOptions = {
            saveLabel: `Save ${filename?.includes('.md') ? 'Markdown' : 'File'}`,
            defaultUri: vscode.Uri.file(filename || 'export'),
        };
        const fileUri = await vscode.window.showSaveDialog(saveDialogOptions);
        if (fileUri) {
            let fileData: Uint8Array;
            if (filename?.toLowerCase().endsWith('.png')) {
                const binaryString = atob(content);
                fileData = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    fileData[i] = binaryString.charCodeAt(i);
                }
            } else {
                fileData = new Uint8Array(Buffer.from(content));
            }
            await vscode.workspace.fs.writeFile(fileUri, fileData);
            vscode.window.showInformationMessage(
                `文件已成功保存到: ${fileUri.fsPath}`
            );
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`下载失败: ${error.message}`);
    }
}

async function collectFiles(
    dirPath: string,
    recursive: boolean,
    results: string[],
    depth: number,
    maxDepth: number,
    maxFiles: number
): Promise<void> {
    if (results.length >= maxFiles || depth > maxDepth) { return; }
    try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (results.length >= maxFiles) { return; }
            if (['.git', 'node_modules', '__pycache__'].includes(entry.name)) {
                continue;
            }
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                results.push(fullPath + path.sep);
                if (recursive) {
                    await collectFiles(fullPath, true, results, depth + 1, maxDepth, maxFiles);
                }
            } else {
                results.push(fullPath);
            }
        }
    } catch {
        // 忽略权限错误
    }
}

export async function handleLoadDirectoryFiles(data: any, webview: vscode.Webview) {
    const { folderPath, recursive = false } = data || {};
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            webview.postMessage({
                type: 'DIRECTORY_FILES',
                data: { folderPath, error: '未找到工作区' },
            });
            return;
        }

        const absPath = path.isAbsolute(folderPath)
            ? folderPath
            : path.join(workspaceFolder.uri.fsPath, folderPath);

        const files: string[] = [];
        await collectFiles(absPath, recursive, files, 0, 3, 500);

        webview.postMessage({
            type: 'DIRECTORY_FILES',
            data: {
                folderPath,
                files: files,
                loadedDirectories: [folderPath],
                isTimeout: false,
            },
        });
    } catch (error: any) {
        webview.postMessage({
            type: 'DIRECTORY_FILES',
            data: { folderPath, error: error.message || '获取目录文件失败' },
        });
    }
}
