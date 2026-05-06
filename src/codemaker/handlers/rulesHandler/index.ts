/**
 * RulesHandler - 管理仓库下的 rules 文件
 * 从 messageHandlers.ts 拆分出来
 */

import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import type { CodeMakerWebviewProvider } from '../../webviewProvider';

/**
 * 解析 .mdc 文件格式
 * ---
 * description: 描述
 * alwaysApply: true/false
 * ---
 * 内容
 */
function parseMdcFile(raw: string): { description: string; alwaysApply: boolean; globs: string[]; content: string } {
    raw = raw.replace(/\r\n/g, '\n');
    const result: { description: string; alwaysApply: boolean; globs: string[]; content: string } = {
        description: '', alwaysApply: true, globs: [], content: raw,
    };
    const frontMatterMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (frontMatterMatch) {
        const meta = frontMatterMatch[1];
        result.content = frontMatterMatch[2];
        const descMatch = meta.match(/description:\s*(.+)/);
        if (descMatch) { result.description = descMatch[1].trim(); }
        const alwaysMatch = meta.match(/alwaysApply:\s*(true|false)/);
        if (alwaysMatch) { result.alwaysApply = alwaysMatch[1] === 'true'; }
        const globsMatch = meta.match(/globs:\s*(.+)/);
        if (globsMatch) {
            const globsStr = globsMatch[1].trim();
            if (globsStr.startsWith('[')) {
                try {
                    result.globs = JSON.parse(globsStr);
                } catch {
                    result.globs = [];
                }
            } else {
                result.globs = globsStr.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
    }
    return result;
}

function stringifyMdcFile(description: string, alwaysApply: boolean, content: string): string {
    return `---\ndescription: ${description}\nalwaysApply: ${alwaysApply}\n---\n${content}`;
}

export async function handleGetRules(provider: CodeMakerWebviewProvider, panelId?: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        provider.sendMessage({ type: 'SYNC_RULES', data: [] });
        return;
    }

    const rules: any[] = [];

    // 1. 加载 .codemaker/rules/*.mdc 文件
    const rulesDir = path.join(workspaceFolder.uri.fsPath, '.y3maker', 'rules');
    try {
        if (fs.existsSync(rulesDir)) {
            const files = await fs.promises.readdir(rulesDir);
            for (const file of files) {
                if (!file.endsWith('.mdc')) { continue; }
                const filePath = path.join(rulesDir, file);
                try {
                    const content = await fs.promises.readFile(filePath, 'utf-8');
                    const parsed = parseMdcFile(content);
                    rules.push({
                        filePath: filePath,
                        name: path.basename(file, '.mdc'),
                        content: parsed.content,
                        isEnabled: true,
                        source: 'codemaker',
                        metaData: {
                            description: parsed.description,
                            alwaysApply: parsed.alwaysApply,
                            globs: parsed.globs,
                        },
                    });
                } catch {
                    // 忽略读取错误
                }
            }
        }
    } catch {
        // 忽略目录错误
    }

    // 2. 加载 .y3maker.codebase.md
    const codebaseMdPath = path.join(workspaceFolder.uri.fsPath, '.y3maker.codebase.md');
    try {
        if (fs.existsSync(codebaseMdPath)) {
            const content = await fs.promises.readFile(codebaseMdPath, 'utf-8');
            if (content.trim()) {
                rules.push({
                    filePath: codebaseMdPath,
                    name: '.y3maker.codebase',
                    content: content,
                    isEnabled: true,
                    source: 'codemaker',
                    metaData: {
                        description: 'Codebase rule',
                        alwaysApply: true,
                        globs: [],
                    },
                });
            }
        }
    } catch {
        // 忽略
    }

    provider.sendMessage({ type: 'SYNC_RULES', data: rules });
}

export async function handleCreateNewRule(data: any, provider: CodeMakerWebviewProvider) {
    const { filename } = data;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) { return; }

    const rulesDir = path.join(workspaceFolder.uri.fsPath, '.y3maker', 'rules');
    await fs.promises.mkdir(rulesDir, { recursive: true });

    const normalizedFileName = filename.endsWith('.mdc') ? filename : `${filename}.mdc`;
    const filePath = path.join(rulesDir, normalizedFileName);

    if (!fs.existsSync(filePath)) {
        const defaultContent = stringifyMdcFile('请填写规则描述', true, '');
        await fs.promises.writeFile(filePath, defaultContent, 'utf-8');
    }

    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);

    await handleGetRules(provider);
}

export async function handleUpdateRule(data: any, provider: CodeMakerWebviewProvider) {
    const { filePath, content } = data;
    if (filePath && content !== undefined) {
        await fs.promises.writeFile(filePath, content, 'utf-8');
        await handleGetRules(provider);
    }
}

export async function handleDeleteRule(data: any, provider: CodeMakerWebviewProvider) {
    const { filePath } = data;
    if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        await handleGetRules(provider);
    }
}
