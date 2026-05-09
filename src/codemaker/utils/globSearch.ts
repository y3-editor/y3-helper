/**
 * glob_search 工具
 *
 * 对齐上游 @/handlers/searchHandler/globHandler.globSearch
 * Y3Helper 简化实现：基于 npm 的 glob 包
 */
import * as vscode from 'vscode';
import * as path from 'path';
import type { ExecuteCommandResult } from './executeFunction';

export async function globSearch(pattern: string, searchPath?: string): Promise<ExecuteCommandResult> {
    if (!pattern) {
        return { content: 'Error: No glob pattern provided.', isError: true };
    }

    let cwd = searchPath || '.';
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!path.isAbsolute(cwd) && workspace) {
        cwd = path.join(workspace, cwd);
    }

    try {
        const { glob } = await import('glob');
        const files = await glob(pattern, {
            cwd,
            nodir: true,
            absolute: false,
            dot: false,
            ignore: ['node_modules/**', '.git/**'],
        });
        const sorted = files.sort();
        const total = sorted.length;
        const display = sorted.slice(0, 200);
        const content = display.join('\n') + (total > 200 ? `\n\n... and ${total - 200} more files` : '');
        return {
            content: content || 'No files matched.',
            isError: false,
            extra: { total },
        };
    } catch (err: any) {
        return { content: `Error during glob search: ${err.message}`, isError: true };
    }
}
