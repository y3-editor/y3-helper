import { env } from "../../env";
import { TreeNode, ViewInExplorerNode, ViewInNewVSCode, ViewInVSCode } from "../treeNode";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

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
                            new TreeNode('本地版本', {
                                iconPath: new vscode.ThemeIcon('versions'),
                                description: '获取中...',
                                tooltip: '获取中...',
                                update: async (node) => {
                                    let version = await y3.version.getClient();
                                    node.description = version ? String(version.display) : '获取失败...';
                                    node.tooltip     = version ? version.display : undefined;
                                },
                            }),
                            new TreeNode('最新版本', {
                                iconPath: new vscode.ThemeIcon('cloud-download'),
                                description: '获取中...',
                                tooltip: '获取中...',
                                update: async (node) => {
                                    let version = await y3.version.getServer();
                                    node.description = version ? String(version.display) : '获取失败...';
                                    node.tooltip     = version ? version.display : undefined;
                                },
                            })
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
