/**
 * 工作区 Handler
 * - GET_WORKSPACE_LIST
 * - GET_WORKSPACE_PROBLEMS
 * - OPEN_WORKSPACE
 * - RELOAD_WINDOW
 */

import * as vscode from 'vscode';
import type { CodeMakerWebviewProvider } from '../webviewProvider';

export function handleGetWorkspaceList(provider: CodeMakerWebviewProvider) {
    const folders = vscode.workspace.workspaceFolders || [];
    provider.sendMessage({
        type: 'SYNC_WORKSPACE_LIST',
        data: {
            workspaces: folders.map(f => ({
                name: f.name,
                path: f.uri.fsPath,
            })),
        },
    });
}

export async function handleGetWorkspaceProblems(webview: vscode.Webview) {
    const diagnostics = vscode.languages.getDiagnostics();
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const lines: string[] = [];

    for (const [uri, diags] of diagnostics) {
        if (workspace && !uri.fsPath.startsWith(workspace)) {
            continue;
        }
        const relativePath = vscode.workspace.asRelativePath(uri, false);

        for (const diag of diags) {
            if (diag.severity > vscode.DiagnosticSeverity.Warning) {
                continue;
            }
            const severity = diag.severity === vscode.DiagnosticSeverity.Error
                ? 'Error' : 'Warning';
            const source = diag.source ? `[${diag.source}]` : '';
            lines.push(
                `${relativePath} - ${source} ${severity} Line ${diag.range.start.line + 1}: ${diag.message}`
            );
        }
    }

    webview.postMessage({
        type: 'ON_GET_WORKSPACE_PROBLEMS',
        data: lines.length > 0 ? lines.join('\n') : '',
    });
}

export async function handleOpenWorkspace() {
    const uris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: '选择工作区文件夹',
    });
    if (uris && uris.length > 0) {
        await vscode.commands.executeCommand('vscode.openFolder', uris[0], false);
    }
}

export async function handleReloadWindow() {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
}
