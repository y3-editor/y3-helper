import moduleAlias from 'module-alias';

moduleAlias.addAliases({
    'y3-helper': __dirname + '/y3-helper'
});

import * as tools from "./tools";
import * as vscode from 'vscode';
import * as mainMenu from './mainMenu';

import { env } from './env';
import { runShell } from './runShell';
import { LuaDocMaker } from './makeLuaDoc';
import { GameLauncher } from './launchGame';
import { NetworkServer } from './networkServer';
import * as console from './console';
import * as metaBuilder from './metaBuilder';
import * as debug from './debug';
import { EditorLauncher } from './launchEditor';
import * as editorTable from './editorTable';
import * as plugin from './plugin';
import * as y3 from 'y3-helper';
import { config } from './config';
import * as globalScript from './globalScript';
import * as luaLanguage from './luaLanguage';
import * as ecaCompiler from './ecaCompiler';

const l10n = vscode.l10n;

class Helper {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    private reloadEnvWhenConfigChange() {
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('Y3-Helper.EditorPath')) {
                tools.log.info(l10n.t('配置已更新，已重新加载环境'));
                await env.updateEditor();
            }
        });
    }

    private registerCommonCommands() {
        vscode.commands.registerCommand('y3-helper.selectAnotherMap', async () => {
            await env.updateMap(false, true);
            if (!vscode.workspace.workspaceFolders?.some((folder) => folder.uri.fsPath === env.scriptUri?.fsPath)) {
                vscode.commands.executeCommand('vscode.openFolder', env.scriptUri);
            }
        });
        vscode.commands.registerCommand('y3-helper.shell', async (...args: any[]) => {
            runShell(l10n.t("执行命令"), args[0], args.slice(1));
        });
    }

    private registerCommandOfNetworkServer() {
        let server: NetworkServer | undefined;
        vscode.commands.registerCommand('y3-helper.networkServer', async () => {
            server?.dispose();
            server = new NetworkServer(25895, 25896);
        });
    }

    private registerCommandOfInitProject() {
        let running = false;
        vscode.commands.registerCommand('y3-helper.initProject', async () => {
            if (running) {
                return;
            }
            running = true;
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: l10n.t('正在初始化Y3项目...'),
            }, async (progress, token) => {
                await env.mapReady(true);
                if (!env.scriptUri) {
                    vscode.window.showErrorMessage(l10n.t('未找到Y3地图路径，请先用编辑器创建地图或重新指定！'));
                    return;
                };

                let scriptUri = env.scriptUri!;
                let y3Uri = env.y3Uri!;

                try {
                    if ((await vscode.workspace.fs.stat(vscode.Uri.joinPath(y3Uri, '.git'))).type === vscode.FileType.Directory) {
                        vscode.window.showErrorMessage(l10n.t('此项目已经初始化过了！'));
                        return;
                    }
                } catch {}

                try {
                    let state = await vscode.workspace.fs.stat(y3Uri);
                    if (state.type === vscode.FileType.Directory) {
                        // 直接删除这个目录
                        try {
                            await vscode.workspace.fs.delete(y3Uri, {
                                recursive: true,
                                useTrash: true,
                            });
                            vscode.window.showInformationMessage(l10n.t('已将原有的 {0} 目录移至回收站', y3Uri.fsPath));
                        } catch (error) {
                            vscode.window.showErrorMessage(l10n.t('{0} 已被占用，请手动删除它！', y3Uri.fsPath));
                            return;
                        }
                    } else {
                        vscode.window.showErrorMessage(l10n.t('{0} 已被占用，请手动删除它！', y3Uri.fsPath));
                        return;
                    };
                } catch (error) {
                    // ignore
                }

                let result = await vscode.window.showInformationMessage(
                    l10n.t('请选择仓库来源：') + '\n' +
                    l10n.t('Github (可能需要代理）') + '\n' +
                    l10n.t('Gitee (国内镜像）'),
                {
                    modal: true,
                }, l10n.t('Github'), l10n.t('Gitee'));

                if (!result) {
                    vscode.window.showWarningMessage(l10n.t('已取消初始化项目'));
                    return;
                }

                if (result === 'Github') {
                    // 从github上 clone 项目，地址为 “https://github.com/y3-editor/y3-lualib”
                    await runShell(l10n.t("初始化Y3项目（Github）"), "git", [
                        "clone",
                        "https://github.com/y3-editor/y3-lualib.git",
                        y3Uri.fsPath,
                    ]);
                } else {
                    await runShell(l10n.t("初始化Y3项目（Gitee）"), "git", [
                        "clone",
                        "https://gitee.com/tsukiko/y3-lualib.git",
                        y3Uri.fsPath,
                    ]);
                }

                if (!y3.fs.isExists(y3Uri, 'README.md')) {
                    vscode.window.showWarningMessage(l10n.t('仓库拉取失败！'));
                    return;
                }

                // 检查编辑器版本，如果是 1.0 版本则切换到 1.0 分支
                let editorVersion = env.editorVersion;
                if (editorVersion === '1.0') {
                    await runShell(l10n.t("初始化Y3项目"), "git", [
                        "checkout",
                        "-b",
                        "1.0",
                        "origin/1.0"
                    ], y3Uri);
                }

                // 初始化配置
                await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(scriptUri, '.log'));
                let copySource = vscode.Uri.joinPath(y3Uri, '演示/项目配置');
                for await (const entry of await vscode.workspace.fs.readDirectory(copySource)) {
                    try {
                        await vscode.workspace.fs.copy(
                            vscode.Uri.joinPath(copySource, entry[0]),
                            vscode.Uri.joinPath(scriptUri, entry[0]),
                            {
                                overwrite: true,
                            }
                        );
                    } catch {}
                }

                // 打开项目
                await this.context.globalState.update("NewProjectPath", scriptUri.fsPath);
                await vscode.commands.executeCommand('vscode.openFolder', scriptUri);

                this.checkNewProject();

                mainMenu.init();
            });
            running = false;
        });
    }

    private registerCommandOfMakeLuaDoc() {
        vscode.commands.registerCommand('y3-helper.makeLuaDoc', async () => {
            await vscode.window.withProgress({
                title: l10n.t('正在生成文档...'),
                location: vscode.ProgressLocation.Window,
            }, async (progress) => {
                let luaDocMaker = new LuaDocMaker(this.context);
                await luaDocMaker.make();
            });
        });
    }

    private registerCommandOfLaunchGame() {
        vscode.commands.registerCommand('y3-helper.launchGame', async () => {
            let luaArgs: Record<string, string> = {};

            if (config.tracy) {
                luaArgs['lua_tracy'] = 'true';
            }

            await vscode.window.withProgress({
                title: l10n.t('正在启动游戏...'),
                location: vscode.ProgressLocation.Window,
            }, async (progress) => {
                let gameLauncher = new GameLauncher();
                await gameLauncher.launch({
                    luaArgs: luaArgs,
                    multi: config.multiMode ? config.multiPlayers.sort() : undefined,
                    tracy: config.tracy,
                });
            });
        });
    }

    private registerCommandOfLaunchGameAndAttach() {
        vscode.commands.registerCommand('y3-helper.launchGameAndAttach', async () => {
            await vscode.window.withProgress({
                title: l10n.t('正在启动游戏...'),
                location: vscode.ProgressLocation.Window,
            }, async (progress) => {
                let gameLauncher = new GameLauncher();

                let luaArgs: Record<string, string> = {};
                if (config.multiMode) {
                    luaArgs['lua_multi_mode'] = 'true';
                    luaArgs['lua_multi_wait_debugger'] = 'true';
                    luaArgs['lua_multi_debug_players'] = config.debugPlayers.sort().join('#');
                    if (config.multiPlayers.length === 0) {
                        vscode.window.showErrorMessage(l10n.t('请至少选择一个玩家才能启动游戏！'));
                        return;
                    }
                } else {
                    luaArgs['lua_wait_debugger'] = 'true';
                }

                if (config.tracy) {
                    luaArgs['lua_tracy'] = 'true';
                }

                let suc = await gameLauncher.launch({
                    luaArgs: luaArgs,
                    multi: config.multiMode ? config.multiPlayers.sort() : undefined,
                    tracy: config.tracy,
                });
                if (!suc) {
                    return;
                }

                await debug.attach();
            });
        });
    }

    private registerCommandOfLaunchEditor() {
        vscode.commands.registerCommand('y3-helper.launchEditor', async () => {
            await vscode.window.withProgress({
                title: l10n.t('正在启动编辑器...'),
                location: vscode.ProgressLocation.Window,
            }, async (progress) => {
                let editorLauncher = new EditorLauncher();
                await editorLauncher.launch();
            });
        });
    }

    private registerCommandOfAttach() {
        vscode.commands.registerCommand('y3-helper.attach', async () => {
            await debug.attach();
        });
    }

    private checkNewProject() {
        let newProjectPath = this.context.globalState.get("NewProjectPath");
        if (!newProjectPath) {
            return;
        };
        if (!vscode.workspace.workspaceFolders) {
            return;
        };
        let workspaceUri = vscode.workspace.workspaceFolders[0].uri;
        if (!workspaceUri) {
            return ;
        };
        if (this.context.globalState.get("NewProjectPath") === workspaceUri.fsPath) {
            this.context.globalState.update("NewProjectPath", undefined);
            new Promise(async () => {
                await vscode.commands.executeCommand(
                    'vscode.open',
                    vscode.Uri.joinPath(workspaceUri, 'main.lua'),
                );
                vscode.window.showInformationMessage(l10n.t("欢迎使用Y3编辑器！"));
            });
        };
    }

    public start() {
        this.registerCommandOfInitProject();
        this.registerCommandOfMakeLuaDoc();
        this.registerCommandOfLaunchGame();
        this.registerCommandOfLaunchGameAndAttach();
        this.registerCommandOfAttach();
        this.registerCommandOfLaunchEditor();
        
        this.reloadEnvWhenConfigChange();

        this.registerCommandOfNetworkServer();
        this.registerCommonCommands();

        setTimeout(() => {
            this.checkNewProject();
            mainMenu.init();
            metaBuilder.init();
            debug.init(this.context);
            console.init();
            editorTable.init();
            plugin.init();
            globalScript.init();
            luaLanguage.init();
            ecaCompiler.init();
            y3.version.init();
        }, 100);
    }
}

export function activate(context: vscode.ExtensionContext) {
    y3.setContext(context);
    let helper = new Helper(context);

    helper.start();
}

export function deactivate() {}
