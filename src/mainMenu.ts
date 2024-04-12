import { env } from './env';
import * as vscode from 'vscode';
import * as tools from './tools';

interface TreeNodeOptional {
    command?: typeof vscode.TreeItem.prototype.command;
    iconPath?: typeof vscode.TreeItem.prototype.iconPath;
    collapsibleState?: typeof vscode.TreeItem.prototype.collapsibleState;
    description?: typeof vscode.TreeItem.prototype.description;
    childs?: TreeNode[];
    update?: (node: TreeNode) => void | Thenable<void>;
    hide?: boolean | ((node: TreeNode) => boolean | Promise<boolean>);
}

class TreeNode extends vscode.TreeItem {
    childs?: TreeNode[];
    parent?: TreeNode;
    hide?: TreeNodeOptional["hide"];
    update?: (node: TreeNode) => void | Thenable<void>;
    constructor(label: string, optional?: TreeNodeOptional) {
        super(label, vscode.TreeItemCollapsibleState.None);
        if (optional) {
            this.command = optional.command;
            this.iconPath = optional.iconPath;
            this.description = optional.description;
            this.childs = optional.childs;
            this.update = optional.update;
            this.hide = optional.hide;
            this.collapsibleState = optional.collapsibleState;
        }
        this.updateChilds();
    }

    updateChilds() {
        if (this.childs) {
            for (let child of this.childs) {
                child.parent = this;
            }
        }
    }
}

class ViewInExplorerNode extends TreeNode {
    constructor(uri: vscode.Uri) {
        super('在Windows中浏览', {
            command: {
                command: 'revealFileInOS',
                title: '在Windows中浏览',
                arguments: [ uri ]
            },
            iconPath: new vscode.ThemeIcon('folder-opened'),
        });
    }
}

class ViewInVSCode extends TreeNode {
    constructor(uri: vscode.Uri) {
        super('在VSCode中打开', {
            command: {
                command: "vscode.openFolder",
                title: '在当前VSCode中打开',
                arguments: [
                    uri,
                ]
            },
            iconPath: new vscode.ThemeIcon('window'),
            update: (node) => {
                if (uri.toString() === vscode.workspace.workspaceFolders?.[0].uri.toString()) {
                    node.iconPath = new vscode.ThemeIcon('error');
                }
            },
        });
    }
}

class ViewInNewVSCode extends TreeNode {
    constructor(uri: vscode.Uri) {
        super('在新的VSCode窗口中打开', {
            command: {
                command: "vscode.openFolder",
                title: '在新的VSCode窗口中打开',
                arguments: [
                    uri,
                    true,
                ]
            },
            iconPath: new vscode.ThemeIcon('empty-window'),
            update: (node) => {
                if (uri.toString() === vscode.workspace.workspaceFolders?.[0].uri.toString()) {
                    node.iconPath = new vscode.ThemeIcon('error');
                }
            },
        });
    }
}

let nodeReselectMapPath = new TreeNode('重新选择Y3地图路径', {
    command: {
        command: 'y3-helper.reloadEnv',
        title: '重新选择Y3地图路径',
    },
    iconPath: new vscode.ThemeIcon('search'),
});

let nodeAction = new TreeNode('功能', {
    iconPath: new vscode.ThemeIcon('beaker'),
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    childs: [
        new TreeNode('初始化Y3库', {
            command: {
                command: 'y3-helper.initProject',
                title: '初始化Y3库',
            },
            update: async (node) => {
                node.iconPath = new vscode.ThemeIcon('cloud-download');
                try {
                    let stat = await vscode.workspace.fs.stat(vscode.Uri.joinPath(env.y3Uri!, '.git'));
                    if (stat.type === vscode.FileType.Directory) {
                        node.iconPath = new vscode.ThemeIcon('check');
                    }
                } catch {}
            },
        }),
        new TreeNode('启动游戏', {
            command: {
                command: 'y3-helper.launchGame',
                title: '启动游戏',
            },
            iconPath: new vscode.ThemeIcon('play'),
        }),
        new TreeNode('启动游戏并附加调试器', {
            command: {
                command: 'y3-helper.launchGameAndAttach',
                title: '启动游戏并附加调试器',
            },
            iconPath: new vscode.ThemeIcon('run-all'),
            description: 'Shift + F5',
        }),
        new TreeNode('查看日志', {
            iconPath: new vscode.ThemeIcon('output'),
            hide: () => {
                return env.scriptUri === undefined;
            },
            update: async (node) => {
                if (env.scriptUri === undefined) {
                    return;
                }
                node.command = {
                    command: 'vscode.open',
                    title: '查看日志',
                    arguments: [vscode.Uri.joinPath(env.scriptUri!, 'log/lua_player01.log')]
                };
            },
        }),
    ]
});

let nodeEnv = new TreeNode('环境', {
    iconPath: new vscode.ThemeIcon('server-environment'),
    childs: [
        new TreeNode('编辑器', {
            update: async (node) => {
                await env.editorReady(true);
                node.tooltip     = env.editorUri?.fsPath;
                node.iconPath    = env.editorUri ? new vscode.ThemeIcon('settings') : new vscode.ThemeIcon('error');
                node.description = env.editorUri ? env.editorUri.fsPath : '未找到编辑器';
                node.childs      = env.editorUri ? [
                    new TreeNode('启动编辑器', {
                        command: {
                            command: 'y3-helper.shell',
                            title: '启动编辑器',
                            arguments: [
                                'start',
                                env.editorUri.fsPath,
                            ]
                        },
                        iconPath: new vscode.ThemeIcon('play'),
                    }),
                    new ViewInExplorerNode(env.editorUri),
                ] : undefined;
            },
        }),
        new TreeNode('Lua脚本', {
            update: async (node) => {
                await env.mapReady(true);
                node.tooltip     = env.scriptUri?.fsPath;
                node.iconPath    = env.scriptUri ? new vscode.ThemeIcon('book') : new vscode.ThemeIcon('error');
                node.description = env.scriptUri ? env.scriptUri.fsPath : '未找到Lua脚本';
                node.childs      = env.scriptUri ? [
                    new ViewInExplorerNode(env.scriptUri),
                    new ViewInVSCode(env.scriptUri),
                    new ViewInNewVSCode(env.scriptUri),
                ] : undefined;
            },
        })
    ],
});

class TreeProvider implements vscode.TreeDataProvider<TreeNode> {
    public refresh = new vscode.EventEmitter<TreeNode | undefined>();
    onDidChangeTreeData = this.refresh.event; 

    async getChildren(node?: TreeNode): Promise<TreeNode[] | undefined> {
        if (!node) {
            await env.mapReady();
            if (!env.scriptUri) {
                return [
                    nodeReselectMapPath
                ];
            }
            return [
                nodeAction,
                nodeEnv,
            ];
        }

        let childs = node.childs?.filter(async (child) => {
            if (child.hide === true) {
                return false;
            }
            if (child.hide instanceof Function) {
                return await child.hide(child);
            }
            return true;
        });

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

export function reveal() {
    if (!mainMenu) {
        return;
    }
    mainMenu.view.reveal(nodeAction, { focus: true, select: false, expand: true });
}
