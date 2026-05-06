/**
 * 可视化 Handler
 * - OPEN_MERMAID / OPEN_PLANTUML / OPEN_GRAPHVIZ
 * - OPEN_HTML
 */

import * as vscode from 'vscode';

export async function handleOpenDiagram(type: string, data: string) {
    const doc = await vscode.workspace.openTextDocument({
        content: data,
        language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
}

export async function handleOpenHtml(data: string) {
    const doc = await vscode.workspace.openTextDocument({
        content: data,
        language: 'html',
    });
    await vscode.window.showTextDocument(doc);
}
