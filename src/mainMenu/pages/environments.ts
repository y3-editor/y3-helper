import { env } from "../../env";
import { TreeNode, ViewInExplorerNode, ViewInNewVSCode, ViewInVSCode } from "../treeNode";
import * as vscode from 'vscode';

export class 环境 extends TreeNode {
    constructor() {
        super('环境', {
            iconPath: new vscode.ThemeIcon('server-environment'),
            show: async () => {
                await env.mapReady();
                return env.scriptUri !== undefined;
            },
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
    }
};
