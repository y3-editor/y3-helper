import * as vscode from 'vscode';
import { GoEditorTableDocumentSymbolProvider, GoEditorTableSymbolProvider } from './fileView';
import { env } from '../env';
import { Table } from '../constants';
import * as editorTable from './editorTable';

class FileNode extends vscode.TreeItem {
    constructor(public tableName: Table.NameCN, key: number) {
        super(`读取中...(${key})`);

        let table = editorTable.open(tableName);
        table.get(key).then((object) => {
            if (!object) {
                return;
            }
            this.label = `${object.name}(${key})`;
            this.resourceUri = object.uri;
        });
    }

    readonly contextValue = 'json';
}

class DirNode extends vscode.TreeItem {
    constructor(public tableName: Table.NameCN) {
        super(`${tableName}(加载中...)`);

        let table = editorTable.open(tableName);
        this.resourceUri = table.uri;

        table.list().then((keys) => {
            this.label = `${tableName}(${keys.length})`;
        });
    }

    readonly contextValue = 'directory';

    public async getChildren(): Promise<FileNode[]> {
        let nodes: FileNode[] = [];
        let table = editorTable.open(this.tableName);
        let keys = await table.list();
        for (const key of keys) {
            nodes.push(new FileNode(this.tableName, key));
        }
        return nodes;
    }
}

type TreeNode = FileNode | DirNode;

class EditorTableDataProvider implements vscode.TreeDataProvider<TreeNode> {
    private async getRoot(): Promise<DirNode[]> {
        let nodes: DirNode[] = [];
        for (const nameCN in Table.name.fromCN) {
            nodes.push(new DirNode(nameCN as Table.NameCN));
        }
        return nodes;
    }

    public async getChildren(node?: TreeNode | undefined) {
        if (node === undefined) {
            return await this.getRoot();
        } else if(node instanceof DirNode) {
            return await node.getChildren();
        } else {
            return [];
        }
    }

    public async getTreeItem(element: FileNode) {
        return element;
    }

    private _onDidChange = new vscode.EventEmitter<TreeNode|undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;
    public refresh() {
        this._onDidChange.fire(undefined);
    }
}

function createTreeView() {
    const editorTableDataProvider = new EditorTableDataProvider();

    const treeView = vscode.window.createTreeView('y3-helper.editorTableView', {
        treeDataProvider: editorTableDataProvider,
        showCollapseAll: true,
    });
    
    vscode.commands.registerCommand('y3-helper.refreshTableViewer', () => {
        editorTableDataProvider.refresh();
    });

    vscode.commands.registerCommand('y3-helper.editorTableView.refresh', () => editorTableDataProvider.refresh());

    return treeView;
}

export async function init() {
    await env.mapReady();

    let treeView: vscode.TreeView<TreeNode>;
    if (env.editorTableUri) {
        treeView = createTreeView();
    }
    env.onDidChange(() => {
        if (treeView) {
            treeView.dispose();
        }
        if (env.editorTableUri) {
            treeView = createTreeView();
        }
    });

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
