import * as vscode from 'vscode';
import { Client } from './client';

class TreeItem extends vscode.TreeItem {
    childs?: number[];
    needRefresh = false;

    constructor(readonly uid: number, name: string) {
        super(name);
    }
}

class TreeDataProvider implements vscode.TreeDataProvider<number> {
    constructor(private manager: TreeViewManager) {
    }

    readonly onDidChange = new vscode.EventEmitter<number | undefined>();
    onDidChangeTreeData = this.onDidChange.event; 

    itemMap = new Map<number, TreeItem>();

    getTreeItem(id: number): Promise<TreeItem> | TreeItem {
        let item = this.getItem(id);
        if (item?.needRefresh === false) {
            return item;
        }
        return (async () => {
            let data = await this.manager.requestGetTreeNode(id);
            if (item) {
                this.updateItem(item, data ?? {});
                item.needRefresh = false;
                return item;
            }
            item = this.createItem(id, data ?? {});
            return item;
        })();
    }

    getChildren(id: number | undefined): Promise<number[]> | number[] {
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
        return (async () => {
            let childs = await this.manager.requestGetChildTreeNodes(id);
            item.childs = childs;
            return childs ?? [];
        })();
    }

    getItem(id: number) {
        return this.itemMap.get(id);
    }

    updateItem(item: TreeItem, data: TreeNodeInfo) {
        item.label = data.name;
        item.description = data.desc;
        item.tooltip = data.tip;
        if (data.check === true) {
            item.checkboxState = vscode.TreeItemCheckboxState.Checked;
        } else if (data.check === false) {
            item.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
        } else {
            item.checkboxState = undefined;
        }
        if (typeof data.icon === 'string') {
            item.iconPath = new vscode.ThemeIcon(data.icon);
        } else {
            item.iconPath = undefined;
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

    createItem(id: number, data: TreeNodeInfo) {
        this.removeItem(id);
        let item = new TreeItem(id, data?.name ?? 'Loading...');
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

    refresh(id: number | undefined, fullRefresh = false) {
        if (fullRefresh) {
            if (id !== undefined) {
                let item = this.itemMap.get(id);
                if (item) {
                    item.childs = undefined;
                    item.needRefresh = true;
                }
            }
        }

        this.onDidChange.fire(id);
    }
}

export class TreeView {

    constructor(
        readonly manager: TreeViewManager,
        readonly id: number,
        readonly name: string,
        readonly root: number,
    ) {}
}

export interface TreeNodeInfo {
    name?: string;
    desc?: string;
    tip?: string;
    icon?: string;
    check?: boolean;
    hasChilds?: boolean;
    canClick?: boolean;
}

export class TreeViewManager extends vscode.Disposable {
    static nextID = 0;
    static allManagers = new Map<number, TreeViewManager>();

    static addManager(manager: TreeViewManager) {
        this.allManagers.set(manager.id, manager);
        if (!this.currentManager) {
            manager.show();
        }
        this.didChange.fire(manager);
    }

    static removeManager(manager: TreeViewManager) {
        this.allManagers.delete(manager.id);
        manager.dispose();
        if (manager === this.currentManager) {
            this.currentManager = undefined;
            this.allManagers.values().next().value?.show();
        }
        this.didChange.fire(manager);
    }

    private static didChange = new vscode.EventEmitter<TreeViewManager>();

    static onDidChange = TreeViewManager.didChange.event;

    static currentManager?: TreeViewManager;

    readonly id = TreeViewManager.nextID++;
    constructor(public client: Client) {
        let disposed = false;
        super(async () => {
            if (disposed) {
                return;
            }
            disposed = true;
            await this.view?.dispose();
            TreeViewManager.removeManager(this);
        });

        TreeViewManager.addManager(this);
    }

    private treeDataProvider = new TreeDataProvider(this);

    private view?: vscode.TreeView<number>;

    readonly treeViews = new Array<TreeView>();
    readonly treeOrder = new Map<string, number>();

    // 从客户端中获取节点信息
    async requestGetTreeNode(id: number): Promise<TreeNodeInfo|undefined> {
        return await this.client.request('getTreeNode', { id });
    }

    // 从客户端中获取子节点
    async requestGetChildTreeNodes(id: number): Promise<number[]|undefined> {
        return await this.client.request('getChildTreeNodes', { id });
    }

    async createTreeView(id: number, name: string, root: number) {
        let treeView = new TreeView(this, id, name, root);
        this.treeViews.push(treeView);
        if (this.treeOrder.has(name)) {
            this.treeViews.sort((a, b) => {
                return this.treeOrder.get(a.name)! - this.treeOrder.get(b.name)!;
            });
        } else {
            this.treeOrder.set(name, this.treeOrder.size);
        }
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
        this.treeDataProvider.refresh(id, true);
    }

    updateTreeNode(id: number, info: TreeNodeInfo) {
        let item = this.treeDataProvider.getItem(id);
        if (!item) {
            return;
        }
        this.treeDataProvider.updateItem(item, info);
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

    async show() {
        if (this === TreeViewManager.currentManager) {
            return;
        } else {
            await TreeViewManager.currentManager?.view?.dispose();
            TreeViewManager.currentManager = this;
        }
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
        this.view.onDidChangeCheckboxState(e => {
            for (const [id, state] of e.items) {
                this.client.notify('changeTreeNodeCheckBox', {
                    id,
                    checked: state === vscode.TreeItemCheckboxState.Checked,
                });
            }
        });
    }
}

vscode.commands.registerCommand('y3-helper.custom.treeViewClick', async (managerID, itemUID) => {
    let manager = TreeViewManager.allManagers.get(managerID);
    if (!manager) {
        return;
    }
    manager.notifyClickTreeNode(itemUID);
});

vscode.commands.registerCommand('y3-helper.custom.show', async (managerID) => {
    let manager = TreeViewManager.allManagers.get(managerID);
    if (!manager) {
        return;
    }
    manager.show();
});
