import { env } from '../env';
import * as vscode from 'vscode';
import { TreeNode, TreeProvider } from './treeNode';
import { 功能 } from './pages/features';
import { 环境 } from './pages/environments';
import { 单位属性 } from './pages/unitAttrs';
import { 玩家属性 } from './pages/playerAttrs';
import { 自定义事件 } from './pages/events';
import { 界面 } from './pages/ui';
import { 时间轴动画 } from './pages/uiAnim';
import { 插件 } from './pages/plugin';
import { 跳字 } from './pages/jumpword';
import { 字体 } from './pages/font';

let mainNode = new TreeNode('主菜单', {
    childs: [
        new 功能,
        new 界面,
        new TreeNode('枚举', {
            iconPath: new vscode.ThemeIcon('list-tree'),
            childs: [
                new 单位属性,
                new 玩家属性,
                new 自定义事件,
                new 时间轴动画,
                new 跳字,
                new 字体,
            ]
        }),
        new 插件,
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

class MainMenu {
    readonly view: vscode.TreeView<TreeNode>;
    readonly tree: TreeProvider;

    constructor () {
        this.tree = new TreeProvider(mainNode);
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

    public async refresh(path?: string) {
        await env.mapReady();
        if (env.scriptUri) {
            this.view.message = undefined;
        } else {
            this.view.message = '未找到Y3地图，请重新选择Y3地图路径！';
        }
        if (path) {
            let paths = path.split('/');
            let node = mainNode;
            for (let i = 0; i < paths.length; i++) {
                if (node.childs === undefined) {
                    return;
                }
                let found = false;
                for (let child of node.childs) {
                    if (child.label === paths[i]) {
                        node = child;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    return;
                }
                this.tree.refresh.fire(node);
            }
        } else {
            this.tree.refresh.fire(undefined);
        }
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

export function refresh(path?: string) {
    if (mainMenu) {
        mainMenu.refresh(path);
    }
}
