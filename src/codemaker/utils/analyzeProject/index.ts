/**
 * 源码分析相关工具：read_file / list_files / view_source_code_definitions_top_level
 *
 * 对齐上游 src/utils/analyzeProject/index.ts
 * Y3Helper 简化版：
 *   - view_source_code_definitions_top_level 复用 list_files（无 tree-sitter 依赖）
 *   - list_files 受限深度 5、最多 500 条，跳过 .git / node_modules 等
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { ExecuteCommandResult } from '../executeFunction';
import { isImageFile } from '../file';

/**
 * read_file 工具
 * tool_params: { path: string, offset?: number, limit?: number }
 */
export async function readFile(params: any): Promise<ExecuteCommandResult> {
    let filePath: string = params?.path || params?.file_path || '';
    if (!filePath) {
        return { content: 'Error: No file path provided.', isError: true };
    }

    // 如果是相对路径，解析为绝对路径
    if (!path.isAbsolute(filePath)) {
        const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspace) {
            filePath = path.join(workspace, filePath);
        }
    }

    try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isDirectory()) {
            return { content: `Error: "${filePath}" is a directory, not a file.`, path: filePath, isError: true };
        }

        if (isImageFile(filePath)) {
            if (stat.size <= 0) {
                return { content: `Error reading image "${filePath}": image file is empty.`, path: filePath, isError: true };
            }

            const imageBuffer = await fs.promises.readFile(filePath);
            if (!imageBuffer.length) {
                return { content: `Error reading image "${filePath}": no image bytes were read.`, path: filePath, isError: true };
            }

            return {
                content: imageBuffer as any,
                path: filePath,
                isError: false,
            };
        }

        const buffer = await fs.promises.readFile(filePath, 'utf-8');
        let lines = buffer.split('\n');

        const offset = Math.max(0, (params?.offset || 1) - 1);
        const limit = params?.limit || 500;
        lines = lines.slice(offset, offset + limit);

        // 添加行号（cat -n 格式）
        const numbered = lines.map((line, i) => {
            const lineNum = offset + i + 1;
            return `${String(lineNum).padStart(6, ' ')}\t${line}`;
        }).join('\n');

        return {
            content: numbered,
            path: filePath,
            isError: false,
        };
    } catch (err: any) {
        return {
            content: `Error reading file "${filePath}": ${err.message}`,
            path: filePath,
            isError: true,
        };
    }
}

/**
 * list_files_top_level / list_files_recursive 工具
 * tool_params: { path: string }
 */
export async function listFiles(params: any, recursive: boolean): Promise<ExecuteCommandResult> {
    let dirPath: string = params?.path || '.';
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!path.isAbsolute(dirPath)) {
        if (workspace) {
            dirPath = path.join(workspace, dirPath);
        }
    }

    try {
        const stat = await fs.promises.stat(dirPath);
        if (!stat.isDirectory()) {
            return { content: `Error: "${dirPath}" is not a directory.`, isError: true };
        }

        const entries = await listDir(dirPath, recursive, workspace || dirPath, 0, 5);
        return {
            content: entries.join('\n'),
            isError: false,
        };
    } catch (err: any) {
        return {
            content: `Error listing directory "${dirPath}": ${err.message}`,
            isError: true,
        };
    }
}

async function listDir(dirPath: string, recursive: boolean, basePath: string, depth: number, maxDepth: number): Promise<string[]> {
    const results: string[] = [];
    try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            // 跳过常见无关目录
            if (['.git', 'node_modules', '.DS_Store', '__pycache__'].includes(entry.name)) {
                continue;
            }
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

            if (entry.isDirectory()) {
                results.push(relativePath + '/');
                if (recursive && depth < maxDepth) {
                    const subEntries = await listDir(fullPath, true, basePath, depth + 1, maxDepth);
                    results.push(...subEntries);
                }
            } else {
                results.push(relativePath);
            }

            if (results.length > 500) {
                results.push('... (truncated, too many entries)');
                break;
            }
        }
    } catch (err) {
        // 忽略权限错误等
    }
    return results;
}

/**
 * view_source_code_definitions_top_level 工具（简化版：返回文件列表）
 * Y3 无 tree-sitter，上游基于 tree-sitter 提取顶级定义，这里退化为 list_files
 */
export async function viewSourceCodeDefinitionsTopLevel(params: any): Promise<ExecuteCommandResult> {
    return listFiles(params, false);
}
