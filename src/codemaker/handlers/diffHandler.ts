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
        // 用 WorkspaceEdit 精确作用在目标文档的 uri 上，
        // 不依赖 activeTextEditor —— 后者在 showTextDocument(preserveFocus=true)
        // 时可能仍指向原来的编辑器，导致内容被写进错误文件。
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            currentDocument.uri,
            new vscode.Range(0, 0, currentDocument.lineCount, 0),
            afterEdit,
        );
        await vscode.workspace.applyEdit(edit);
        await currentDocument.save();

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

// 参考上游 DiffViewProvider.getReplacedCode：做纯文本替换，
// 不做 indent 调整以保持轻量；indent 调整上游也是启发式，不完全可靠。
function getReplacedCode(rawCode: string, searches: string[], replaces: string[]): string {
    let result = rawCode;
    for (let i = 0; i < searches.length; i++) {
        const s = searches[i];
        const r = replaces[i] ?? '';
        if (!s) { continue; }
        if (result.includes(s)) {
            result = result.replace(s, r);
        }
    }
    return result;
}

export async function handleBatchApplyChanges(data: any, provider: CodeMakerWebviewProvider) {
    const { type: actionType, fileChanges = {} } = data;
    const isRevert = actionType === 'revert';
    const appliedCodeBlockIds: string[] = [];
    const createdPaths: string[] = [];
    const allCodeBlocks: string[] = [];
    let msgId = '';

    try {
        for (const [filePath, codeBlocks] of Object.entries(fileChanges as Record<string, any>)) {
            const absPath = resolveFilePath(filePath);
            let fileExist = fs.existsSync(absPath);
            // 聚合每个文件的 search / replace 列表
            const curSearchCodes: string[] = [];
            const curReplacedCodes: string[] = [];
            const blockIds: string[] = [];
            let isNewFile = !fileExist;

            for (const [codeBlockId, blockData] of Object.entries(codeBlocks as Record<string, any>)) {
                const {
                    searchCodes = [],
                    replacedCodes = [],
                    createdFilePaths = [],
                    messageId,
                } = blockData || {};
                if (messageId) { msgId = messageId; }
                allCodeBlocks.push(codeBlockId);
                blockIds.push(codeBlockId);

                const searches: string[] = Array.isArray(searchCodes) ? searchCodes : [];
                const replaces: string[] = Array.isArray(replacedCodes) ? replacedCodes : [];
                curSearchCodes.push(...searches);
                curReplacedCodes.push(...replaces);

                // webview 会把「AI 新建过的文件」记到 createdFilePaths 中
                if (Array.isArray(createdFilePaths) && createdFilePaths.includes(filePath) && !isNewFile) {
                    isNewFile = true;
                }

                // 对已存在文件的逐块修改
                if (!isNewFile) {
                    try {
                        const currentDocument = await vscode.workspace.openTextDocument(absPath);
                        const rawCode = currentDocument.getText().replace(/\r\n/g, '\n');
                        const replaced = isRevert
                            ? getReplacedCode(rawCode, replaces, searches)
                            : getReplacedCode(rawCode, searches, replaces);
                        if (replaced && replaced !== rawCode) {
                            const edit = new vscode.WorkspaceEdit();
                            edit.replace(
                                currentDocument.uri,
                                new vscode.Range(0, 0, currentDocument.lineCount, 0),
                                replaced,
                            );
                            await vscode.workspace.applyEdit(edit);
                            await currentDocument.save();
                            appliedCodeBlockIds.push(codeBlockId);
                        }
                    } catch (err) {
                        console.error('[Y3Maker] BATCH_APPLY_CHANGES apply single block failed:', err);
                    }
                }
            }

            // 新文件整体处理
            if (isNewFile) {
                createdPaths.push(filePath);
                try {
                    if (isRevert) {
                        if (fs.existsSync(absPath)) {
                            await fs.promises.unlink(absPath);
                        }
                    } else {
                        // 纯代码块场景 replacedCodes 可能为空，此时 fallback 到 searchCodes
                        // （ChatCodeBlock 里非 SEARCH/REPLACE 格式会把整段代码塞进 searchCodes）
                        let newContent = curReplacedCodes.join('\n');
                        if (!newContent) {
                            newContent = curSearchCodes.join('\n');
                        }
                        await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
                        await fs.promises.writeFile(absPath, newContent, 'utf-8');
                    }
                    appliedCodeBlockIds.push(...blockIds);
                } catch (err) {
                    console.error('[Y3Maker] BATCH_APPLY_CHANGES create/revert file failed:', err);
                }
            }
        }

        if (!appliedCodeBlockIds.length) {
            provider.sendMessage({
                type: 'BATCH_APPLY_CHANGES_FAILED',
                data: { messageId: msgId, message: '未找到应用位置' },
            });
            return;
        }

        provider.sendMessage({
            type: 'BATCH_APPLY_CHANGES_SUCCESS',
            data: {
                type: actionType,
                messageId: msgId,
                createdFilePaths: createdPaths,
                appliedCodeBlockIds,
                replacedCodes: [],
                status: allCodeBlocks.length === appliedCodeBlockIds.length ? 'all' : 'part',
            },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'BATCH_APPLY_CHANGES_FAILED',
            data: { messageId: msgId, message: err.message },
        });
    }
}

export async function handleApplySingleChanges(data: any, provider: CodeMakerWebviewProvider) {
    // webview 单文件应用：{ type, diffId, codeBlockIds, fileChange: { codeBlockId: meta } }
    // fileChange 中每个 meta 都含 filePath，通常同一个 filePath。
    // 这里把它改造成 fileChanges: { filePath: { codeBlockId: meta } } 交给批量实现。
    const { type, codeBlockIds = [], fileChange = {} } = data || {};
    const fileChanges: Record<string, Record<string, any>> = {};
    for (const codeBlockId of codeBlockIds) {
        const meta = fileChange[codeBlockId];
        if (!meta || !meta.filePath) { continue; }
        if (!fileChanges[meta.filePath]) { fileChanges[meta.filePath] = {}; }
        fileChanges[meta.filePath][codeBlockId] = meta;
    }
    await handleBatchApplyChanges({ type, fileChanges }, provider);
}
