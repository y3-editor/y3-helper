/**
 * 文件写入/编辑工具（对齐上游 src/utils/editFile/index.ts）
 *
 * Y3Helper 实现：
 *   - write_to_file：创建/覆写（不落盘，前端 ACCEPT_EDIT 写盘）
 *   - edit_file / reapply：新文件直接使用 codeEdit；已有内容调 apply API 做 AI 合并
 *   - Apply API 通过本地 API Server /api/v1/apply/edit 访问
 *
 * 与上游差异：
 *   上游 editFile 直接调 LSP / fs 写盘；Y3Helper 保持"生成新内容 + 前端 ACCEPT_EDIT"分离流程
 */
import * as vscode from 'vscode';
import { existsSync, readFileSync } from 'fs';
import * as http from 'http';
import { getCodeMakerConfig } from '../../configProvider';
import { resolveWorkspacePath } from '../getWorkspaceInfo';
import type { ExecuteCommandResult, ToolProvider } from '../executeFunction';

/**
 * write_to_file 工具：创建新文件或完全覆写已有文件
 */
export async function writeToFile(params: any): Promise<ExecuteCommandResult> {
    try {
        const filePath = params?.path;
        const content = params?.content ?? '';
        if (!filePath) {
            return { content: 'Error: path is required.', isError: true, path: '' };
        }
        const absolutePath = resolveWorkspacePath(filePath);
        const fileExist = existsSync(absolutePath);
        const currentContent = fileExist ? readFileSync(absolutePath, 'utf-8') : '';

        // 不在这里写磁盘，前端通过 ACCEPT_EDIT 执行真正写入
        return {
            content: content,
            isError: false,
            path: filePath,
            extra: {
                beforeEdit: currentContent,
                finalResult: content,
                isCreateFile: !fileExist,
                filePath: filePath,
                taskId: '',
            },
        };
    } catch (err: any) {
        return { content: `Error writing file: ${err.message}`, isError: true, path: '' };
    }
}

export interface EditFileParams {
    targetFile: string;
    codeEdit: string;
    isCreateFile?: boolean;
    toolCallId?: string;
    provider: ToolProvider;
}

/**
 * edit_file / reapply 工具：对齐源码版 editFile
 * 新文件/空文件 → 直接使用 codeEdit
 * 已有内容 → 调用本地 API Server 的 /api/v1/apply/edit 做 AI 智能合并
 */
export default async function editFile(params: EditFileParams): Promise<ExecuteCommandResult> {
    const { targetFile, codeEdit, provider } = params;
    try {
        if (!targetFile) {
            return { content: 'Error: target_file is required.', isError: true, path: '' };
        }
        const absolutePath = resolveWorkspacePath(targetFile);
        const fileExist = existsSync(absolutePath);
        let currentContent = '';

        if (fileExist) {
            const doc = await vscode.workspace.openTextDocument(absolutePath);
            currentContent = doc.getText();
        }
        // 宽容处理：AI 经常省略 is_create_file

        let updatedContent: string;
        if (currentContent === '' || !fileExist) {
            // 新文件或空文件：直接使用 codeEdit
            updatedContent = codeEdit;
        } else {
            // 已有内容的文件：调用 apply API 做智能合并
            try {
                updatedContent = await applyEditViaApi(currentContent, codeEdit, absolutePath, provider.apiServerPort);
                console.log(`[Y3Maker] edit_file: apply API 合并成功, result.length=${updatedContent.length}`);
            } catch (applyErr: any) {
                console.warn(`[Y3Maker] edit_file: apply API 失败 (${applyErr.message}), 回退为直接覆写`);
                // 回退：直接使用 codeEdit
                updatedContent = codeEdit;
            }
        }

        // 不在这里写磁盘！前端会通过 ACCEPT_EDIT 来执行真正的写入
        return {
            content: updatedContent,
            path: targetFile,
            extra: {
                editSnippet: codeEdit,
                beforeEdit: currentContent,
                finalResult: updatedContent,
                isCreateFile: !fileExist,
                filePath: targetFile,
                taskId: '',
            },
            isError: false,
        };
    } catch (err: any) {
        return { content: `Error editing file: ${err.message}`, isError: true, path: targetFile || '' };
    }
}

/**
 * 调用本地 API Server 的 /api/v1/apply/edit 做智能合并
 * 对齐源码版 getFinalResultStream
 */
async function applyEditViaApi(
    beforeEdit: string,
    editSnippet: string,
    filePath: string,
    apiPort: number,
): Promise<string> {
    if (!apiPort) {
        throw new Error('API Server 未启动');
    }

    // 换行符归一化
    const normalizedBefore = beforeEdit.replace(/\r\n/g, '\n');
    const normalizedSnippet = editSnippet.replace(/\r\n/g, '\n');

    // 构建和源码版 getFinalResultStream 一样的请求体
    const systemPrompt = "You are a coding assistant that helps merge code updates, ensuring every modification is fully integrated.";
    const userPrompt = `Merge all changes from the <update> snippet into the <code> below.
- Preserve the code's structure, order, comments, and indentation exactly.
- Output only the updated code, enclosed within <updated-code> and </updated-code> tags.
- Do not include any additional text, explanations, placeholders, ellipses, or code fences.
- Do not change unrelavant parts beyond the update.

<code>${normalizedBefore}</code>

<update>${normalizedSnippet}</update>

Provide the complete updated code.`;

    const requestBody = JSON.stringify({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        model: getCodeMakerConfig().model,
        temperature: 0,
        original_content: normalizedBefore,
        code_edit: normalizedSnippet,
        task_id: '',
        stream: true,
        filePath: filePath,
        isFallback: false,
    });

    return new Promise<string>((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: apiPort,
            path: '/api/v1/apply/edit',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody),
            },
            timeout: 30000,
        }, (res: any) => {
            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => {
                // 解析 SSE 流式响应，提取合并结果
                let content = '';
                const lines = data.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const json = JSON.parse(line.slice(6));
                            const delta = json?.choices?.[0]?.delta?.content;
                            if (delta) { content += delta; }
                        } catch { /* 跳过非 JSON 行 */ }
                    }
                }

                if (!content) {
                    reject(new Error('apply API 返回空内容'));
                    return;
                }

                // 提取 <updated-code> 标签内的内容
                let finalResult = content;
                if (finalResult.includes('<updated-code>') && finalResult.includes('</updated-code>')) {
                    const match = finalResult.match(/<updated-code>([\s\S]*?)<\/updated-code>/);
                    if (match) { finalResult = match[1]; }
                }

                // 去掉可能的 code fence
                const trimmed = finalResult.trim();
                const fenceMatch = trimmed.match(/^```(\w+)?\s*\n([\s\S]*?)\n```$/);
                if (fenceMatch) { finalResult = fenceMatch[2]; }

                // 还原换行符
                if (beforeEdit.includes('\r\n')) {
                    finalResult = finalResult.replace(/\n/g, '\r\n');
                }

                resolve(finalResult);
            });
        });

        req.on('error', (err: any) => reject(err));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('apply API 请求超时'));
        });
        req.write(requestBody);
        req.end();
    });
}
