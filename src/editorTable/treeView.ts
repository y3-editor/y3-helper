import * as vscode from 'vscode';
import { GoEditorTableDocumentSymbolProvider, GoEditorTableSymbolProvider } from './fileView';
import { env } from '../env';
import { Table } from '../constants';
import * as editorTable from './editorTable';

class FileNode extends vscode.TreeItem {
    constructor(
        private dir: DirNode,
        public tableName: Table.NameCN,
        key: number,
    ) {
        super(`加载中...(${key})`);

        let table = editorTable.open(tableName);
        table.get(key).then((object) => {
            if (!object) {
                return;
            }
            this.label = `${object.name}(${key})`;
            this.resourceUri = object.uri;
            this.refresh();
        });
    }

    readonly contextValue = 'json';

    public refresh() {
        this.dir.provider.refresh(this.dir);
    }
}

class DirNode extends vscode.TreeItem {
    constructor(
        public provider: TreeViewProvider,
        public tableName: Table.NameCN,
    ) {
        super(`${tableName}(加载中...)`);

        let table = editorTable.open(tableName);
        this.resourceUri = table.uri;

        table.list().then((keys) => {
            this.label = `${tableName}(${keys.length})`;
            this.refresh();
        });
    }

    readonly contextValue = 'directory';
    readonly collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    public async getChildren(): Promise<FileNode[]> {
        let nodes: FileNode[] = [];
        let table = editorTable.open(this.tableName);
        let keys = await table.list();
        for (const key of keys) {
            nodes.push(new FileNode(this, this.tableName, key));
        }
        return nodes;
    }

    public refresh() {
        this.provider.refresh(this);
    }
}

type TreeNode = FileNode | DirNode;

class TreeViewProvider implements vscode.TreeDataProvider<TreeNode> {
    private async getRoot(): Promise<DirNode[]> {
        let nodes: DirNode[] = [];
        for (const nameCN in Table.name.fromCN) {
            nodes.push(new DirNode(this, nameCN as Table.NameCN));
        }
        return nodes;
    }

    public async getChildren(node?: TreeNode | undefined) {
        if (node === undefined) {
            return await this.getRoot();
        } else if(node instanceof DirNode) {
            return await node.getChildren();
        } else {
            return undefined;
        }
    }

    public async getTreeItem(node: TreeNode) {
        return node;
    }

    private _onDidChange = new vscode.EventEmitter<TreeNode|undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;
    public refresh(node?: TreeNode) {
        this._onDidChange.fire(node);
    }
}

class TreeView extends vscode.Disposable {
    constructor() {
        super(() => {
            this.disposables.forEach(d => d.dispose());
        });
        this.provider = new TreeViewProvider();

        this.disposables.push(this.treeView = vscode.window.createTreeView('y3-helper.editorTableView', {
            treeDataProvider: this.provider,
            showCollapseAll: true,
        }));

        env.onDidChange(() => this.refresh());

        this.disposables.push(vscode.commands.registerCommand('y3-helper.refreshTableViewer', () => this.provider.refresh()));

        this.disposables.push(vscode.commands.registerCommand('y3-helper.editorTableView.refresh', () => this.provider.refresh()));

        this.disposables.push(vscode.commands.registerCommand('y3-helper.openFile', async (fileNode: FileNode) => {
            if (!fileNode.resourceUri) {
                return;
            }
            vscode.commands.executeCommand('vscode.open', fileNode.resourceUri);
        }));
    }

    async refresh() {
        await env.mapReady();
        this.provider.refresh();
    }

    private provider: TreeViewProvider;
    private treeView: vscode.TreeView<TreeNode>;
    private disposables: vscode.Disposable[] = [];
}

export async function init() {
    await env.mapReady();

    let treeView = new TreeView();

    // const goEditorTableSymbolProvider = new GoEditorTableSymbolProvider();
    
    // vscode.languages.registerWorkspaceSymbolProvider(goEditorTableSymbolProvider);

    // const goEditorTableDocumentSymbolProvider = new GoEditorTableDocumentSymbolProvider();
    // let sel: vscode.DocumentSelector = { scheme: 'file', language: 'json' };
    // vscode.languages.registerDocumentSymbolProvider(sel, goEditorTableDocumentSymbolProvider);


    // 右键菜单的命令注册
    // vscode.commands.registerCommand("y3-helper.deleteEditorTableItem", (fileNode: FileNode) => {
    //     try {
    //         vscode.workspace.fs.delete(fileNode.resourceUri);
    //     }
    //     catch (error) {
    //         vscode.window.showErrorMessage("删除失败，错误为" + error);
    //     }
    //     //editorTableDataProvider.refresh();
    // });

    // vscode.commands.registerCommand("y3-helper.revealInFileExplorer", (fileNode: FileNode) => {
    //     // vscode自带的从系统文件浏览器中打开某一文件的命令
    //     vscode.commands.executeCommand('revealFileInOS', fileNode.resourceUri);
    // });

    // vscode.commands.registerCommand("y3-helper.copyTableItemUID", (fileNode: FileNode) => {
    //     if (fileNode.uid) {
    //         vscode.env.clipboard.writeText(String(fileNode.uid));
    //     }
    // });

    // vscode.commands.registerCommand("y3-helper.copyTableItemName", (fileNode: FileNode) => {
    //     if (fileNode.name) {
    //         vscode.env.clipboard.writeText(fileNode.name);
    //     }
    // });

    // vscode.commands.registerCommand("y3-helper.addNewEditorTableItem", async (fileNode: FileNode) => {
    //     await env.mapReady(true);
    //     const inputOptions: vscode.InputBoxOptions = {
    //         prompt: '名称',
    //         value: fileNode.name,
    //         placeHolder: '名称',
    //         validateInput: (text: string) => {
    //             if (text.length === 0) {
    //                 return "输入的内容为空";
    //             }
    //             return null;
    //         }
    //     };
    //     vscode.window.showInputBox(inputOptions).then(
    //         value => {
    //             if (value) {
    //                 if (editorTableDataProvider.createNewTableItemByFileNode(fileNode,value)) {
    //                     vscode.window.showInformationMessage("成功创建"+fileNode.label+":" + value);
    //                 }
    //             }
    //         }
    //     );
    // });

    // vscode.commands.registerCommand("y3-helper.renameEditorTableItem", (fileNode: FileNode) => {
    //     const inputOptions: vscode.InputBoxOptions = {
    //         prompt: '修改后的新名称',
    //         value: fileNode.name,
    //         placeHolder: '新名称',
    //         validateInput: (text: string) => {
    //             if (text.length === 0) {
    //                 return "输入的内容为空";
    //             }
    //             return null;
    //         }
    //     };
    //     vscode.window.showInputBox(inputOptions).then(
    //         value => {
    //             if (value) {
    //                 editorTableDataProvider.renameEditorTableItemByFileNode(fileNode, value);
    //             }
    //         }
    //     );
    // });
}
