/**
 * 设置/配置 Handler
 * - OPEN_EXTENSION_SETTING_AUTHORIZATION_PATH
 * - ADD_AUTHORIZATION_PATH
 * - UPDATE_CHAT_SUBMIT_KEY
 * - EDIT_CODEBASE_RULES
 */

import * as vscode from 'vscode';
import * as path from 'path';

export function handleOpenExtensionSetting() {
    vscode.commands.executeCommand(
        'workbench.action.openSettings', 'Y3Maker'
    );
}

export function handleAddAuthorizationPath() {
    vscode.commands.executeCommand(
        'workbench.action.openSettings', 'Y3Maker'
    );
}

export async function handleEditCodebaseRules() {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('未找到工作区文件夹');
            return;
        }
        const filePath = path.join(
            workspaceFolder.uri.fsPath, '.y3maker.codebase.md'
        );
        const fileUri = vscode.Uri.file(filePath);

        try {
            await vscode.workspace.fs.stat(fileUri);
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
        } catch {
            await vscode.workspace.fs.writeFile(
                fileUri, new Uint8Array(Buffer.from('', 'utf8'))
            );
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
            vscode.window.showInformationMessage(
                '已创建 .y3maker.codebase.md 文件'
            );
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`操作失败：${error.message}`);
    }
}
