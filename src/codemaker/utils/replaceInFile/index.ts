/**
 * replace_in_file 工具（对齐上游 src/utils/replaceInFile/index.ts）
 *
 * Y3Helper 使用源码版三层匹配引擎 constructNewFileContent
 * 不在此处写磁盘，前端通过 ACCEPT_EDIT 执行真正的写入
 */
import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { constructNewFileContent } from '../../tools/constructNewFileContent';
import { resolveWorkspacePath } from '../getWorkspaceInfo';
import type { ExecuteCommandResult } from '../executeFunction';

export interface ReplaceInFileParams {
    targetFile: string;
    replaceSnippet: string;
    isCreateFile?: boolean;
    toolCallId?: string;
}

export default async function replaceInFile(params: ReplaceInFileParams): Promise<ExecuteCommandResult> {
    const { targetFile, replaceSnippet, isCreateFile } = params;
    try {
        if (!targetFile) {
            return { content: 'Error: target_file is required.', isError: true, path: '' };
        }
        const absolutePath = resolveWorkspacePath(targetFile);
        const fileExist = existsSync(absolutePath);
        let currentContent = '';

        if (!fileExist) {
            if (!isCreateFile) {
                // 宽容处理：文件不存在时自动创建（AI 经常省略 is_create_file）
                console.log(`[Y3Maker] replace_in_file: file not exist, auto creating: ${absolutePath}`);
            }
        } else {
            const doc = await vscode.workspace.openTextDocument(absolutePath);
            currentContent = doc.getText();
        }

        // 换行符归一化
        const normalizedContent = currentContent.replace(/\r\n/g, '\n');
        const normalizedSnippet = (replaceSnippet ?? '').replace(/\r\n/g, '\n');

        // 使用源码版三层匹配引擎
        const updatedContent = constructNewFileContent(normalizedSnippet, normalizedContent);

        // 还原换行符
        const originalUseCRLF = currentContent.includes('\r\n');
        const finalContent = originalUseCRLF ? updatedContent.replace(/\n/g, '\r\n') : updatedContent;

        // 不在这里写磁盘！前端会通过 ACCEPT_EDIT 来执行真正的写入
        return {
            content: finalContent,
            path: targetFile,
            extra: {
                beforeEdit: currentContent,
                finalResult: finalContent,
                isCreateFile: !fileExist,
                filePath: targetFile,
                taskId: '',
                fallbackApply: false,
            },
            isError: false,
        };
    } catch (err: any) {
        return { content: `Error replace in file: ${err.message}`, isError: true, path: targetFile || '' };
    }
}
