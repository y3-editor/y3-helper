import { Env } from './env';
import * as vscode from 'vscode';
import * as tools from './tools';

interface TreeNodeOptional {
    command?: vscode.Command;
    iconPath?: typeof vscode.TreeItem.prototype.iconPath;
    collapsibleState?: vscode.TreeItemCollapsibleState;
    childs?: TreeNode[];
}

class TreeNode extends vscode.TreeItem {
    childs?: TreeNode[];
    constructor(label: string, optional?: TreeNodeOptional) {
        super(label, vscode.TreeItemCollapsibleState.None);
        if (optional) {
            this.command = optional.command;
            this.iconPath = optional.iconPath;
            this.childs = optional.childs;
            this.collapsibleState = optional.collapsibleState ?? (this.childs ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        }
    }
}

let nodeReselectMapPath = new TreeNode('重新选择Y3地图路径', {
    command: {
        command: 'y3-helper.reloadEnv',
        title: '重新选择Y3地图路径',
    },
    iconPath: new vscode.ThemeIcon('search'),
});

let nodeEnv = new TreeNode('当前环境', {
    iconPath: new vscode.ThemeIcon('gear'),
    childs: [
        new TreeNode('编辑器', {
            iconPath: 'image/logo.png',
        }),
        nodeReselectMapPath,
    ],
});

class TreeProvider implements vscode.TreeDataProvider<TreeNode> {
    public env: Env;
    public refresh = new vscode.EventEmitter<TreeNode | undefined>();
    onDidChangeTreeData = this.refresh.event; 

    constructor(env: Env) {
        this.env = env;
    }

    async getChildren(node?: TreeNode): Promise<TreeNode[] | undefined> {
        if (!node) {
            await this.env.waitReady();
            if (!this.env.scriptUri) {
                return [
                    nodeReselectMapPath
                ];
            }
            return [
                nodeEnv,
            ];
        }
        return node.childs;
    }

    getTreeItem(node: TreeNode): TreeNode {
        return node;
    }
}

export class MainMenu {
    private view: vscode.TreeView<TreeNode>;
    private tree: TreeProvider;
    private state: 'not init' | 'initing' | 'inited' = 'not init';

    constructor (env: Env) {
        this.tree = new TreeProvider(env);
        this.view = vscode.window.createTreeView('y3-helper.mainMenu', {
            treeDataProvider: this.tree,
        });
        this.view.onDidChangeVisibility(async (e) => {
            if (e.visible) {
                if (this.state !== 'not init') {
                    return;
                }
                this.state = 'initing';
                this.view.message = '正在初始化...';
                await env.waitReady();
                this.state = 'inited';
                this.refresh(env);
            }
        });
    }

    private refresh(env: Env) {
        if (env.scriptUri) {
            this.view.message = undefined;
        } else {
            this.view.message = '未找到Y3地图，请重新选择Y3地图路径！';
        }
        this.tree.env = env;
        this.tree.refresh.fire(undefined);
    }

    reload(env: Env) {
        this.refresh(env);
    }
}
