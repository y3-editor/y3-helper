import * as vscode from 'vscode';
import { FileNode, EditorTableDataProvider } from './editorTableProvider';
import { GoEditorTableDocumentSymbolProvider, GoEditorTableSymbolProvider } from './fileView';
import { env } from '../env';

export function init() {
    const editorTableDataProvider = new EditorTableDataProvider();
    
    vscode.window.createTreeView('y3-helper.editorTableView', {
        treeDataProvider: editorTableDataProvider,
        showCollapseAll: true,
    });
    
    vscode.commands.registerCommand('y3-helper.refreshTableViewer', () => {
        editorTableDataProvider.refresh();
    });

    vscode.commands.registerCommand('y3-helper.editorTableView.refresh', () => editorTableDataProvider.refresh());

    const goEditorTableSymbolProvider = new GoEditorTableSymbolProvider();
    
    vscode.languages.registerWorkspaceSymbolProvider(goEditorTableSymbolProvider);

    const goEditorTableDocumentSymbolProvider = new GoEditorTableDocumentSymbolProvider();
    let sel: vscode.DocumentSelector = { scheme: 'file', language: 'json' };
    vscode.languages.registerDocumentSymbolProvider(sel, goEditorTableDocumentSymbolProvider);
    

    // 右键菜单的命令注册
    vscode.commands.registerCommand("y3-helper.deleteEditorTableItem", (fileNode: FileNode) => {
        try {
            vscode.workspace.fs.delete(fileNode.resourceUri);
        }
        catch (error) {
            vscode.window.showErrorMessage("删除失败，错误为" + error);
        }
        //editorTableDataProvider.refresh();
    });

    vscode.commands.registerCommand("y3-helper.revealInFileExplorer", (fileNode: FileNode) => {
        // vscode自带的从系统文件浏览器中打开某一文件的命令
        vscode.commands.executeCommand('revealFileInOS', fileNode.resourceUri);
    });

    vscode.commands.registerCommand("y3-helper.copyTableItemUID", (fileNode: FileNode) => {
        if (fileNode.uid) {
            vscode.env.clipboard.writeText(String(fileNode.uid));
        }
    });

    vscode.commands.registerCommand("y3-helper.copyTableItemName", (fileNode: FileNode) => {
        if (fileNode.name) {
            vscode.env.clipboard.writeText(fileNode.name);
        }
    });

    vscode.commands.registerCommand("y3-helper.addNewEditorTableItem", async (fileNode: FileNode) => {
        await env.mapReady(true);
        const inputOptions: vscode.InputBoxOptions = {
            prompt: '名称',
            value: fileNode.name,
            placeHolder: '名称',
            validateInput: (text: string) => {
                if (text.length === 0) {
                    return "输入的内容为空";
                }
                return null;
            }
        };
        vscode.window.showInputBox(inputOptions).then(
            value => {
                if (value) {
                    if (editorTableDataProvider.createNewTableItemByFileNode(fileNode,value)) {
                        vscode.window.showInformationMessage("成功创建"+fileNode.label+":" + value);
                    }
                }
            }
        );
    });

    vscode.commands.registerCommand("y3-helper.renameEditorTableItem", (fileNode: FileNode) => {
        const inputOptions: vscode.InputBoxOptions = {
            prompt: '修改后的新名称',
            value: fileNode.name,
            placeHolder: '新名称',
            validateInput: (text: string) => {
                if (text.length === 0) {
                    return "输入的内容为空";
                }
                return null;
            }
        };
        vscode.window.showInputBox(inputOptions).then(
            value => {
                if (value) {
                    editorTableDataProvider.renameEditorTableItemByFileNode(fileNode, value);
                }
            }
        );
    });
}
