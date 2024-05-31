import * as vscode from 'vscode';
import { Client, registerMethod } from './client';

class TreeItem extends vscode.TreeItem {
    childs?: number[];

    constructor(readonly uid: number, name: string) {
        super(name);
        this.id = uid.toString();
    }
}

class TreeDataProvider implements vscode.TreeDataProvider<number> {
    constructor(private treeView: TreeView, private root: number) {
    }

    private onDidChange = new vscode.EventEmitter<number | undefined>();
    onDidChangeTreeData = this.onDidChange.event; 

    itemMap = new Map<number, TreeItem>();

    async getTreeItem(id: number): Promise<TreeItem> {
        let data = await this.treeView.manager.requestGetTreeNode(id);
        let item = this.createItem(id, data);
        return item;
    }

    async getChildren(id: number | undefined): Promise<number[]> {
        if (id === undefined) {
            return [this.root];
        }
        let item = this.itemMap.get(id);
        if (!item) {
            return [];
        }
        if (item.childs) {
            return item.childs;
        }
        let childs = await this.treeView.manager.requestGetChildTreeNodes(id);
        item.childs = childs;
        return childs;
    }

    private createItem(id: number, data: getTreeNodeResponse) {
        this.removeItem(id);
        let item = new TreeItem(id, data.name);
        this.itemMap.set(id, item);
        this.treeView.addOwnedID(id);
        if (typeof data.desc === 'string') {
            item.description = data.desc;
        }
        if (typeof data.icon === 'string') {
            item.iconPath = new vscode.ThemeIcon(data.icon);
        }
        if (data.hasChilds) {
            if (id === this.root) {
                item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            } else {
                item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            }
        }
        return item;
    }
    private removeItem(id: number) {
        let item = this.itemMap.get(id);
        if (!item) {
            return;
        }
        this.itemMap.delete(id);
        this.treeView.removeOwnedID(id);
        if (item.childs) {
            for (const child of item.childs) {
                this.removeItem(child);
            }
        }
    }

    refresh(id: number) {
        this.removeItem(id);
        this.onDidChange.fire(id);
    }
}

export class TreeView extends vscode.Disposable {
    private view: vscode.TreeView<number>;
    readonly ownedIDs = new Set<number>();
    private treeDataProvider: TreeDataProvider;

    constructor(
        readonly manager: TreeViewManager,
        readonly id: number,
        readonly name: string,
        private root: number,
    ) {
        super(() => {
            this.view.dispose();
        });

        this.treeDataProvider = new TreeDataProvider(this, root);

        this.view = vscode.window.createTreeView('y3-helper.client', {
            treeDataProvider: this.treeDataProvider,
            showCollapseAll: true,
        });
        this.view.onDidExpandElement(e => {
            let item = this.treeDataProvider.itemMap.get(e.element);
            if (item && item.childs) {
                this.manager.notifyChangeTreeNodeVisible(item.childs, true);
            }
        });
        this.view.onDidCollapseElement(e => {
            let item = this.treeDataProvider.itemMap.get(e.element);
            if (item && item.childs) {
                this.manager.notifyChangeTreeNodeVisible(item.childs, false);
            }
        });
        vscode.commands.executeCommand('y3-helper.client.focus');
    }

    refresh(id: number) {
        this.treeDataProvider.refresh(id);
    }

    addOwnedID(id: number) {
        this.ownedIDs.add(id);
    }

    removeOwnedID(id: number) {
        this.ownedIDs.delete(id);
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

    findTreeViewByNodeID(id: number): TreeView | undefined {
        for (const view of this.treeViews.values()) {
            if (view.ownedIDs.has(id)) {
                return view;
            }
        }
        return undefined;
    }

    // 从客户端中获取节点信息
    async requestGetTreeNode(id: number): Promise<getTreeNodeResponse> {
        return await this.client.request('getTreeNode', { id });
    }

    // 从客户端中获取子节点
    async requestGetChildTreeNodes(id: number): Promise<number[]> {
        return await this.client.request('getChildTreeNodes', { id });
    }

    async createTreeView(id: number, name: string, root: number) {
        let treeView = new TreeView(this, id, name, root);
        this.treeViews.set(id, treeView);
        return treeView;
    }

    refreshTreeNode(id: number) {
        let treeView = this.findTreeViewByNodeID(id);
        if (!treeView) {
            return;
        }
        treeView.refresh(id);
    }

    notifyChangeTreeNodeVisible(ids: number[], visible: boolean) {
        this.client.request('changeTreeNodeVisible', { ids, visible });
    }
}
