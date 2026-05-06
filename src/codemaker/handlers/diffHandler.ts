/**
 * Diff 预览与代码应用 Handler
 * - PREVIEW_DIFF_CODE / PREVIEW_DIFF_EDIT / PREVIEW_DIFF_FILE
 * - ACCEPT_EDIT / BATCH_ACCEPT_EDIT
 * - REVERT_EDIT / BATCH_REVERT_EDIT
 * - REAPPLY_EDIT / REAPPLY_REPLACE
 * - BATCH_APPLY_CHANGES / APPLY_SINGLE_CHANGES
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { CodeMakerWebviewProvider } from '../webviewProvider';

function resolveFilePath(filePath: string): string {
    if (path.isAbsolute(filePath)) { return filePath; }
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return workspace ? path.join(workspace, filePath) : filePath;
}

function getLanguageId(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescriptreact',
        '.js': 'javascript',
        '.jsx': 'javascriptreact',
        '.py': 'python',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.php': 'php',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.lua': 'lua',
        '.json': 'json',
        '.xml': 'xml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.less': 'less',
        '.sql': 'sql',
        '.sh': 'shellscript',
        '.bat': 'bat',
        '.ps1': 'powershell',
    };
    return langMap[ext] || 'plaintext';
}

function applySearchReplaceDiff(content: string, diff: string): string {
    let result = content;
    const blocks = diff.split('------- SEARCH');

    for (const block of blocks) {
        if (!block.trim()) { continue; }
        const parts = block.split('=======');
        if (parts.length < 2) { continue; }

        const searchPart = parts[0].trim();
        let replacePart = parts.slice(1).join('=======');
        replacePart = replacePart.replace(/\+{7}\s*REPLACE\s*$/, '').trim();

        if (searchPart) {
            result = result.replace(searchPart, replacePart);
        }
    }
    return result;
}

// ─── Diff 预览 ─────────────────────────────────────────

export async function handlePreviewDiffCode(data: any, provider: CodeMakerWebviewProvider) {
    const { filePath, searchCodes = [], replacedCodes = [] } = data;
    const absPath = resolveFilePath(filePath);

    try {
        let originalContent = '';
        if (fs.existsSync(absPath)) {
            originalContent = await fs.promises.readFile(absPath, 'utf-8');
        }

        let newContent = originalContent;
        for (let i = 0; i < searchCodes.length; i++) {
            const search = searchCodes[i] || '';
            const replace = replacedCodes[i] || '';
            if (search) {
                newContent = newContent.replace(search, replace);
            } else if (replace) {
                newContent = newContent ? newContent + '\n' + replace : replace;
            }
        }

        const originalDoc = await vscode.workspace.openTextDocument({
            content: originalContent,
            language: getLanguageId(filePath),
        });
        const newDoc = await vscode.workspace.openTextDocument({
            content: newContent,
            language: getLanguageId(filePath),
        });

        await vscode.commands.executeCommand(
            'vscode.diff',
            originalDoc.uri,
            newDoc.uri,
            `Diff: ${path.basename(filePath)}`
        );
    } catch (err: any) {
        console.error('[Y3Maker] PREVIEW_DIFF_CODE error:', err);
    }
}

export async function handlePreviewDiffEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { filePath, finalResult, isCreateFile, beforeEdit } = data;
    const absPath = resolveFilePath(filePath);

    try {
        let originalContent = '';
        if (!isCreateFile && fs.existsSync(absPath)) {
            originalContent = await fs.promises.readFile(absPath, 'utf-8');
        }

        const originalDoc = await vscode.workspace.openTextDocument({
            content: originalContent,
            language: getLanguageId(filePath),
        });
        const newDoc = await vscode.workspace.openTextDocument({
            content: finalResult || '',
            language: getLanguageId(filePath),
        });

        await vscode.commands.executeCommand(
            'vscode.diff',
            originalDoc.uri,
            newDoc.uri,
            `${isCreateFile ? 'New' : 'Edit'}: ${path.basename(filePath)}`
        );

        provider.sendMessage({
            type: 'PREVIEW_DIFF_RESULT',
            data: { success: true, filePath },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'PREVIEW_DIFF_RESULT',
            data: { success: false, message: err.message, filePath },
        });
    }
}

export async function handlePreviewDiffFile(data: any, provider: CodeMakerWebviewProvider) {
    await handlePreviewDiffEdit(data, provider);
}

// ─── Accept Edit ───────────────────────────────────────

export async function handleAcceptEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { item, force } = data;
    const { toolCallId, filePath, beforeEdit, finalResult, isCreateFile } = item;

    try {
        const absPath = resolveFilePath(filePath);
        let fileExist = fs.existsSync(absPath);

        if (isCreateFile && !fileExist) {
            await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
            await fs.promises.writeFile(absPath, '', 'utf-8');
        }

        const currentDocument = await vscode.workspace.openTextDocument(absPath);

        if (currentDocument.isDirty) {
            console.log(`[Y3Maker] ACCEPT_EDIT: 文件有未保存改动, path=${absPath}`);
            provider.sendMessage({
                type: 'ACCEPT_EDIT_RESULT',
                data: {
                    result: {
                        success: false,
                        message: '文件有未保存改动，请先保存文件后再应用',
                        item,
                    },
                },
            });
            return;
        }

        const currentContent = currentDocument.getText();
        const afterEdit = finalResult || '';

        if (currentContent.replace(/\r\n/g, '\n') === afterEdit.replace(/\r\n/g, '\n') && fileExist) {
            console.log(`[Y3Maker] ACCEPT_EDIT: 内容已一致，跳过写入`);
            provider.sendMessage({
                type: 'ACCEPT_EDIT_RESULT',
                data: { result: { success: true, item } },
            });
            return;
        }

        if (!force && fileExist && beforeEdit) {
            if (currentContent.replace(/\s/g, '') !== beforeEdit.replace(/\s/g, '')) {
                console.log(`[Y3Maker] ACCEPT_EDIT: 文件内容有变动, beforeEdit.length=${beforeEdit.length}, currentContent.length=${currentContent.length}`);
                provider.sendMessage({
                    type: 'ACCEPT_EDIT_RESULT',
                    data: {
                        result: {
                            success: false,
                            message: '文件内容有变动，请尝试 reapply',
                            item,
                        },
                    },
                });
                return;
            }
        }

        await vscode.window.showTextDocument(currentDocument, {
            preview: false,
            viewColumn: vscode.ViewColumn.Active,
            preserveFocus: true,
        });
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
                currentDocument.uri,
                new vscode.Range(0, 0, currentDocument.lineCount, 0),
                afterEdit,
            );
            await vscode.workspace.applyEdit(edit);
            await currentDocument.save();
        }

        provider.sendMessage({
            type: 'ACCEPT_EDIT_RESULT',
            data: { result: { success: true, message: '', item } },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'ACCEPT_EDIT_RESULT',
            data: { result: { success: false, message: err.message, item } },
        });
    }
}

export async function handleBatchAcceptEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { items = [] } = data;
    const results: any[] = [];

    for (const item of items) {
        try {
            const absPath = resolveFilePath(item.filePath);
            if (item.isCreateFile) {
                await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
            }
            await fs.promises.writeFile(absPath, item.finalResult || '', 'utf-8');
            results.push({ success: true, message: '', item });
        } catch (err: any) {
            results.push({ success: false, message: err.message, item });
        }
    }

    provider.sendMessage({
        type: 'BATCH_ACCEPT_EDIT_RESULT',
        data: { results },
    });
}

// ─── Revert Edit ───────────────────────────────────────

export async function handleRevertEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { item } = data;
    const { filePath, originalContent, finalResult, isCreateFile } = item;

    try {
        const absPath = resolveFilePath(filePath);
        if (isCreateFile) {
            if (fs.existsSync(absPath)) {
                await fs.promises.unlink(absPath);
            }
        } else {
            await fs.promises.writeFile(
                absPath, originalContent || '', 'utf-8'
            );
        }

        provider.sendMessage({
            type: 'REVERT_EDIT_RESULT',
            data: { result: { success: true, message: '', item } },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'REVERT_EDIT_RESULT',
            data: { result: { success: false, message: err.message, item } },
        });
    }
}

export async function handleBatchRevertEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { items = [] } = data;
    const results: any[] = [];

    for (const item of items) {
        try {
            const absPath = resolveFilePath(item.filePath);
            if (item.isCreateFile) {
                if (fs.existsSync(absPath)) {
                    await fs.promises.unlink(absPath);
                }
            } else {
                await fs.promises.writeFile(
                    absPath, item.originalContent || '', 'utf-8'
                );
            }
            results.push({ success: true, message: '', item });
        } catch (err: any) {
            results.push({ success: false, message: err.message, item });
        }
    }

    provider.sendMessage({
        type: 'BATCH_REVERT_EDIT_RESULT',
        data: { results },
    });
}

// ─── Reapply ───────────────────────────────────────────

export async function handleReapplyEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { target_file, code_edit, toolCallId, isCreateFile } = data;
    try {
        const absPath = resolveFilePath(target_file);
        let beforeEdit = '';
        if (!isCreateFile && fs.existsSync(absPath)) {
            beforeEdit = await fs.promises.readFile(absPath, 'utf-8');
        }

        const finalResult = code_edit || '';
        if (isCreateFile) {
            await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
        }
        await fs.promises.writeFile(absPath, finalResult, 'utf-8');

        provider.sendMessage({
            type: 'REAPPLY_EDIT_RESULT',
            data: {
                toolCallId,
                filePath: absPath,
                finalResult,
                beforeEdit,
                isError: false,
                isCreateFile,
            },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'REAPPLY_EDIT_RESULT',
            data: {
                toolCallId,
                filePath: target_file,
                finalResult: '',
                beforeEdit: '',
                isError: true,
                isCreateFile,
            },
        });
    }
}

export async function handleReapplyReplace(data: any, provider: CodeMakerWebviewProvider) {
    const { target_file, diff, toolCallId, isCreateFile } = data;
    try {
        const absPath = resolveFilePath(target_file);
        let beforeEdit = '';
        if (!isCreateFile && fs.existsSync(absPath)) {
            beforeEdit = await fs.promises.readFile(absPath, 'utf-8');
        }

        let finalResult = beforeEdit;
        if (diff) {
            finalResult = applySearchReplaceDiff(beforeEdit, diff);
        }

        if (isCreateFile) {
            await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
        }
        await fs.promises.writeFile(absPath, finalResult, 'utf-8');

        provider.sendMessage({
            type: 'REAPPLY_REPLACE_RESULT',
            data: {
                toolCallId,
                filePath: absPath,
                finalResult,
                beforeEdit,
                isError: false,
                isCreateFile,
            },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'REAPPLY_REPLACE_RESULT',
            data: {
                toolCallId,
                filePath: target_file,
                finalResult: '',
                beforeEdit: '',
                isError: true,
                isCreateFile,
            },
        });
    }
}

// ─── Batch Apply ───────────────────────────────────────

export async function handleBatchApplyChanges(data: any, provider: CodeMakerWebviewProvider) {
    const { type: actionType, fileChanges = {} } = data;
    const isRevert = actionType === 'revert';
    const appliedCodeBlockIds: string[] = [];
    let hasError = false;

    try {
        for (const [filePath, codeBlocks] of Object.entries(fileChanges as Record<string, any>)) {
            const absPath = resolveFilePath(filePath);
            let content = '';

            if (fs.existsSync(absPath)) {
                content = await fs.promises.readFile(absPath, 'utf-8');
            }

            for (const [codeBlockId, blockData] of Object.entries(codeBlocks as Record<string, any>)) {
                try {
                    const searchCode = isRevert
                        ? (blockData.replacedCode || '')
                        : (blockData.searchCode || '');
                    const replaceCode = isRevert
                        ? (blockData.searchCode || '')
                        : (blockData.replacedCode || '');

                    if (searchCode) {
                        content = content.replace(searchCode, replaceCode);
                    } else if (replaceCode) {
                        content += '\n' + replaceCode;
                    }

                    appliedCodeBlockIds.push(codeBlockId);
                } catch {
                    hasError = true;
                }
            }

            await fs.promises.writeFile(absPath, content, 'utf-8');
        }

        provider.sendMessage({
            type: 'BATCH_APPLY_CHANGES_SUCCESS',
            data: {
                appliedCodeBlockIds,
                status: hasError ? 'part' : 'all',
            },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'BATCH_APPLY_CHANGES_FAILED',
            data: { message: err.message },
        });
    }
}

export async function handleApplySingleChanges(data: any, provider: CodeMakerWebviewProvider) {
    await handleBatchApplyChanges(data, provider);
}
