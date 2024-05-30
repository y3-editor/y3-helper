import { TreeNode, TreeProvider } from '../treeNode';
import * as vscode from 'vscode';
import { Client, registerMethod } from './client';

export class TreeView extends vscode.Disposable {
    private view: vscode.TreeView<TreeNode>;
    private rootNode?: TreeNode;
    private tree?: TreeProvider;

    constructor(
        readonly id: number,
        readonly name: string,
        private root: number,
    ) {
        super(() => {
            this.view.dispose();
        });

        this.rootNode = new TreeNode('root', {

        });
        this.tree = new TreeProvider(new TreeNode(name, {}));

        this.view = vscode.window.createTreeView('y3-helper.client', {
            treeDataProvider: this.tree,
        });
    }
}

interface getTreeNodeResponse {
    name: string;
    desc: string;
    icon: string;
    hasChilds: boolean;
}

export class TreeViewManager extends vscode.Disposable {
    constructor(private client: Client) {
        super(() => {
            this.treeViews.forEach(view => view.dispose());
        });
    }

    private treeViews = new Map<number, TreeView>();

    async requestNode(id: number): Promise<getTreeNodeResponse> {
        return await this.client.request('getTreeNode', { id });
    }

    async createTreeView(id: number, name: string, root: number) {
        let treeView = new TreeView(id, name, root);
        this.treeViews.set(id, treeView);
        return treeView;
    }

    refreshTreeNode(id: number) {
    }
}

interface CreateTreeViewParams {
    id: number;
    name: string;
    root: number;
}

registerMethod('createTreeView', async (client, params: CreateTreeViewParams) => {
    let rootData = await client.treeViewManager.requestNode(params.root);
    let root = new TreeNode(rootData.name, {
    });
    await client.treeViewManager.createTreeView(params.id, params.name, params.root);
});

interface refreshTreeNodeParams {
    id: number;
}

registerMethod('refreshTreeNode', async (client, params: refreshTreeNodeParams) => {
    client.treeViewManager.refreshTreeNode(params.id);
});
