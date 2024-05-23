import * as vscode from 'vscode';

let refreshCallback: (node: TreeNode) => void;

export interface TreeNodeOptional {
    command?: typeof vscode.TreeItem.prototype.command;
    iconPath?: typeof vscode.TreeItem.prototype.iconPath;
    collapsibleState?: typeof vscode.TreeItem.prototype.collapsibleState;
    description?: typeof vscode.TreeItem.prototype.description;
    contextValue?: typeof vscode.TreeItem.prototype.contextValue;
    childs?: TreeNode[];
    update?: (node: TreeNode) => void | Thenable<void>;
    show?: boolean | ((node: TreeNode) => boolean | Promise<boolean>);
    data?: any;
}

export class TreeNode extends vscode.TreeItem {
    childs?: TreeNode[];
    parent?: TreeNode;
    show?: TreeNodeOptional["show"] = true;
    update?: TreeNodeOptional["update"];
    data?: any;
    constructor(label: string, optional?: TreeNodeOptional) {
        super(label, vscode.TreeItemCollapsibleState.None);
        if (optional) {
            this.command = optional.command;
            this.iconPath = optional.iconPath;
            this.description = optional.description;
            this.contextValue = optional.contextValue;
            this.childs = optional.childs;
            this.update = optional.update;
            this.show = optional.show ?? true;
            this.collapsibleState = optional.collapsibleState;
            this.data = optional.data;
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

    refresh() {
        refreshCallback?.(this);
    }
}

export class ViewInExplorerNode extends TreeNode {
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

export class ViewInVSCode extends TreeNode {
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

export class ViewInNewVSCode extends TreeNode {
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

export function onRefresh(callback: typeof refreshCallback) {
    refreshCallback = callback;
}
