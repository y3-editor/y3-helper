import * as vscode from 'vscode';
import { Client } from './client';

class TreeItem extends vscode.TreeItem {
    childs?: number[];

    constructor(readonly uid: number, name: string) {
        super(name);
        this.id = `${name}(${uid})`;
    }
}

class TreeDataProvider implements vscode.TreeDataProvider<number> {
    constructor(private manager: TreeViewManager) {
    }

    readonly onDidChange = new vscode.EventEmitter<number | undefined>();
    onDidChangeTreeData = this.onDidChange.event; 

    itemMap = new Map<number, TreeItem>();

    async getTreeItem(id: number): Promise<TreeItem> {
        let data = await this.manager.requestGetTreeNode(id);
        let item = this.getItem(id);
        if (item) {
            if (data) {
                this.updateItem(item, data);
            }
            return item;
        }
        if (!data) {
            return new TreeItem(id, 'Loading...');
        }
        return this.createItem(id, data);
    }

    async getChildren(id: number | undefined): Promise<number[]> {
        if (id === undefined) {
            return this.manager.treeViews.map(view => view.root);
        }
        let item = this.itemMap.get(id);
        if (!item) {
            return [];
        }
        if (item.childs) {
            return item.childs;
        }
        let childs = await this.manager.requestGetChildTreeNodes(id);
        item.childs = childs;
        if (!childs) {
            return [];
        }
        return childs;
    }

    getItem(id: number) {
        return this.itemMap.get(id);
    }

    updateItem(item: TreeItem, data: getTreeNodeResponse) {
        if (typeof data.desc === 'string') {
            item.description = data.desc;
        }
        if (typeof data.tip === 'string') {
            item.tooltip = data.tip;
        }
        if (typeof data.icon === 'string') {
            item.iconPath = new vscode.ThemeIcon(data.icon);
        }
        if (data.hasChilds) {
            if (this.manager.treeViews.find(view => view.root === item.uid)) {
                item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            } else {
                item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            }
        }
        if (data.canClick) {
            item.command = {
                command: 'y3-helper.custom.treeViewClick',
                title: '',
                arguments: [this.manager.id, item.uid],
            };
        }
    }

    createItem(id: number, data: getTreeNodeResponse) {
        this.removeItem(id);
        let item = new TreeItem(id, data.name);
        this.itemMap.set(id, item);
        this.updateItem(item, data);
        return item;
    }

    removeItem(id: number) {
        let item = this.itemMap.get(id);
        if (!item) {
            return;
        }
        this.itemMap.delete(id);
        if (item.childs) {
            for (const child of item.childs) {
                this.removeItem(child);
            }
        }
    }

    refresh(id: number | undefined) {
        this.onDidChange.fire(id);
    }
}

export class TreeView {

    constructor(
        readonly manager: TreeViewManager,
        readonly id: number,
        readonly name: string,
        readonly root: number,
    ) {
        vscode.commands.executeCommand('y3-helper.custom.focus');
    }
}

interface getTreeNodeResponse {
    name: string;
    desc?: string;
    tip?: string;
    icon?: string;
    hasChilds?: boolean;
    canClick?: boolean;
}

export class TreeViewManager extends vscode.Disposable {
    static nextID = 0;
    static allManagers = new Map<number, TreeViewManager>();

    readonly id = TreeViewManager.nextID++;
    constructor(private client: Client) {
        super(() => {
            this.view.dispose();
            TreeViewManager.allManagers.delete(this.id);
        });

        TreeViewManager.allManagers.set(this.id, this);
        this.treeDataProvider = new TreeDataProvider(this);

        this.view = vscode.window.createTreeView('y3-helper.custom', {
            treeDataProvider: this.treeDataProvider,
            showCollapseAll: true,
        });
        this.view.onDidExpandElement(e => {
            this.notifyChangeTreeNodeExpanded(e.element, true);
            let item = this.treeDataProvider.itemMap.get(e.element);
            if (item && item.childs) {
                this.notifyChangeTreeNodeVisible(item.childs, true);
            }
        });
        this.view.onDidCollapseElement(e => {
            this.notifyChangeTreeNodeExpanded(e.element, false);
            let item = this.treeDataProvider.itemMap.get(e.element);
            if (item && item.childs) {
                this.notifyChangeTreeNodeVisible(item.childs, false);
            }
        });
    }

    private view: vscode.TreeView<number>;
    readonly treeDataProvider: TreeDataProvider;

    readonly treeViews = new Array<TreeView>();

    // 从客户端中获取节点信息
    async requestGetTreeNode(id: number): Promise<getTreeNodeResponse|undefined> {
        return await this.client.request('getTreeNode', { id });
    }

    // 从客户端中获取子节点
    async requestGetChildTreeNodes(id: number): Promise<number[]|undefined> {
        return await this.client.request('getChildTreeNodes', { id });
    }

    async createTreeView(id: number, name: string, root: number) {
        let treeView = new TreeView(this, id, name, root);
        this.treeViews.push(treeView);
        this.treeDataProvider.refresh(undefined);
        return treeView;
    }

    async removeTreeView(id: number) {
        let treeView = this.treeViews.find(view => view.id === id);
        if (!treeView) {
            return;
        }
        this.treeViews.splice(this.treeViews.indexOf(treeView), 1);
        this.treeDataProvider.removeItem(treeView.root);
        this.treeDataProvider.refresh(undefined);
    }

    refreshTreeNode(id: number) {
        this.treeDataProvider.refresh(id);
    }

    notifyChangeTreeNodeVisible(ids: number[], visible: boolean) {
        this.client.notify('changeTreeNodeVisible', { ids, visible });
    }

    notifyClickTreeNode(id: number) {
        this.client.notify('clickTreeNode', { id });
    }

    notifyChangeTreeNodeExpanded(id: number, expanded: boolean) {
        this.client.notify('changeTreeNodeExpanded', { id, expanded });
    }
}

vscode.commands.registerCommand('y3-helper.custom.treeViewClick', async (managerID, itemUID) => {
    let manager = TreeViewManager.allManagers.get(managerID);
    if (!manager) {
        return;
    }
    manager.notifyClickTreeNode(itemUID);
});
