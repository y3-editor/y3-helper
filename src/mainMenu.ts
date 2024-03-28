import { Env } from './env';
import * as vscode from 'vscode';
import * as tools from './tools';

interface TreeNodeOptional {
    command?: typeof vscode.TreeItem.prototype.command;
    iconPath?: typeof vscode.TreeItem.prototype.iconPath;
    collapsibleState?: typeof vscode.TreeItem.prototype.collapsibleState;
    description?: typeof vscode.TreeItem.prototype.description;
    childs?: TreeNode[];
    update?: (node: TreeNode, env: Env) => void | Thenable<void>;
}

class TreeNode extends vscode.TreeItem {
    childs?: TreeNode[];
    update?: (node: TreeNode, env: Env) => void | Thenable<void>;
    constructor(label: string, optional?: TreeNodeOptional) {
        super(label, vscode.TreeItemCollapsibleState.None);
        if (optional) {
            this.command = optional.command;
            this.iconPath = optional.iconPath;
            this.description = optional.description;
            this.childs = optional.childs;
            this.update = optional.update;
            this.collapsibleState = optional.collapsibleState;
        }
    }
}

class ViewInExplorerNode extends TreeNode {
    constructor(uri: vscode.Uri) {
        super('在Windows中浏览', {
            command: {
                command: 'y3-helper.shell',
                title: '在Windows中浏览',
                arguments: [
                    'explorer',
                    uri.fsPath,
                ]
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
            update: (node, env) => {
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
            update: (node, env) => {
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
            update: async (node, env) => {
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
        
    ]
});

let nodeEnv = new TreeNode('环境', {
    iconPath: new vscode.ThemeIcon('server-environment'),
    childs: [
        new TreeNode('编辑器', {
            update: (node, env) => {
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
                    new ViewInExplorerNode(vscode.Uri.joinPath(env.editorUri, '..')),
                ] : undefined;
            },
        }),
        new TreeNode('Lua脚本', {
            update: (node, env) => {
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
                nodeAction,
                nodeEnv,
            ];
        }
        return node.childs;
    }

    async getTreeItem(node: TreeNode): Promise<TreeNode> {
        await node.update?.(node, this.env);
        node.collapsibleState = node.collapsibleState ?? (node.childs ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
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
