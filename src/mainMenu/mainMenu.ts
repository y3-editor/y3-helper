import { env } from '../env';
import * as vscode from 'vscode';
import { TreeNode, onRefresh } from './treeNode';
import { 功能 } from './pages/features';
import { 环境 } from './pages/environments';
import { 单位属性 } from './pages/unitAttrs';
import { 玩家属性 } from './pages/playerAttrs';

let mainNode = new TreeNode('主菜单', {
    childs: [
        new 功能,
        new 单位属性,
        new 玩家属性,
        new 环境,
        new TreeNode('重新选择Y3地图路径', {
            command: {
                command: 'y3-helper.selectAnotherMap',
                title: '重新选择Y3地图路径',
            },
            iconPath: new vscode.ThemeIcon('search'),
        }),
    ]
});

class TreeProvider implements vscode.TreeDataProvider<TreeNode> {
    public refresh = new vscode.EventEmitter<TreeNode | undefined>();
    onDidChangeTreeData = this.refresh.event; 

    async getChildren(node?: TreeNode): Promise<TreeNode[] | undefined> {
        node = node ?? mainNode;

        if (node.childs === undefined) {
            return undefined;
        }

        let childs = [];
        for (const child of node.childs) {
            if (child.show instanceof Function) {
                let show = await child.show(child);
                if (!show) {
                    continue;
                }
            }
            if (!child.show) {
                continue;
            }
            childs.push(child);
        }

        if (childs?.length === 0) {
            return undefined;
        }
        return childs;
    }

    async getTreeItem(node: TreeNode): Promise<TreeNode> {
        await node.update?.(node);
        node.updateChilds();
        node.collapsibleState = node.collapsibleState ?? (node.childs ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        return node;
    }

    getParent(node: TreeNode): TreeNode | undefined {
        return node.parent;
    }
}

class MainMenu {
    readonly view: vscode.TreeView<TreeNode>;
    readonly tree: TreeProvider;

    constructor () {
        this.tree = new TreeProvider();
        this.view = vscode.window.createTreeView('y3-helper.mainMenu', {
            treeDataProvider: this.tree,
        });
        this.view.onDidChangeVisibility(async (e) => {
            if (e.visible) {
                this.refresh();
            }
        });
        env.onDidChange(() => {
            this.refresh();
        });
        onRefresh((node) => {
            this.tree.refresh.fire(node);
        });
    }

    private async refresh() {
        await env.mapReady();
        if (env.scriptUri) {
            this.view.message = undefined;
        } else {
            this.view.message = '未找到Y3地图，请重新选择Y3地图路径！';
        }
        this.tree.refresh.fire(undefined);
    }

    async reload() {
        await this.refresh();
    }
}

export let mainMenu: MainMenu | undefined;

export function init() {
    if (mainMenu) {
        mainMenu.reload();
    } else {
        mainMenu = new MainMenu();
    }
}
