import moduleAlias from 'module-alias';

moduleAlias.addAliases({
    'y3-helper': __dirname + '/y3-helper'
});

import * as tools from "./tools";
import * as vscode from 'vscode';
import * as mainMenu from './mainMenu';

import { env } from './env';
import { runShell } from './runShell';
import { getConfigRepoUrl, checkForUpdates, migrateOldUser, performUpdate, forceRemoteUpdate, clearCachedUpdateStatus, getCachedUpdateStatus } from './y3makerConfig';
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
import * as l10n from '@vscode/l10n';
import * as mcp from './mcp';
import { getMcpHub } from './codemaker/mcpHandlers';
import { initCodeMaker, stopCodeMaker, webviewProvider } from './codemaker';

class Helper {
    private context: vscode.ExtensionContext;
    private tcpServer?: mcp.TCPServer;
    private autoStartMCPTask?: Promise<void>;

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
            if (!vscode.workspace.workspaceFolders?.some((folder) => folder.uri.fsPath === env.projectUri?.fsPath)) {
                vscode.commands.executeCommand('vscode.openFolder', env.projectUri);
            }
        });
        vscode.commands.registerCommand('y3-helper.shell', async (...args: any[]) => {
            runShell(l10n.t("执行命令"), args[0], args.slice(1));
        });
    }

    private registerCommandOfUpdateY3MakerConfig() {
        vscode.commands.registerCommand('y3-helper.updateY3MakerConfig', async () => {
            if (!env.projectUri) {
                return;
            }
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: l10n.t('正在更新 Y3Maker 配置...'),
            }, async () => {
                const result = await performUpdate(env.projectUri!);

                if (result.success) {
                    // 更新成功
                    clearCachedUpdateStatus();
                    if (webviewProvider) {
                        await webviewProvider.reloadCodemakerResources();
                    }
                    mainMenu.refresh();
                    vscode.window.showInformationMessage(l10n.t('Y3Maker 配置已更新成功！'));
                } else {
                    // 有冲突
                    const useRemote = l10n.t('使用远端版本');
                    const handleSelf = l10n.t('自行解决');
                    const choice = await vscode.window.showWarningMessage(
                        l10n.t('Y3Maker 配置更新时发生冲突，请选择处理方式：'),
                        { modal: true },
                        useRemote,
                        handleSelf,
                    );

                    if (choice === useRemote) {
                        await forceRemoteUpdate(env.projectUri!);
                        clearCachedUpdateStatus();
                        if (webviewProvider) {
                            await webviewProvider.reloadCodemakerResources();
                        }
                        mainMenu.refresh();
                        vscode.window.showInformationMessage(l10n.t('Y3Maker 配置已强制更新到远端版本！'));
                    } else {
                        vscode.window.showInformationMessage(
                            l10n.t('请在终端中手动处理 .y3maker 目录的 git 冲突')
                        );
                    }
                }
            });
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

                const optionsGithub = 'Github (可能需要代理）';
                const optionsGitee  = 'Gitee (国内镜像）';
                let repoSource: 'github' | 'gitee' = 'github';
                if (env.language === 'zh-cn') {
                    let result = await vscode.window.showInformationMessage(l10n.t('请选择仓库来源：'),
                    {
                        modal: true,
                    }, optionsGithub, optionsGitee);

                    if (result === optionsGithub) {
                        repoSource = 'github';
                        // 从github上 clone 项目，地址为 "https://github.com/y3-editor/y3-lualib"
                        await runShell(l10n.t("初始化Y3项目（Github）"), "git", [
                            "clone",
                            "https://github.com/y3-editor/y3-lualib.git",
                            y3Uri.fsPath,
                        ]);
                    } else if (result === optionsGitee)  {
                        repoSource = 'gitee';
                        await runShell(l10n.t("初始化Y3项目（Gitee）"), "git", [
                            "clone",
                            "https://gitee.com/tsukiko/y3-lualib.git",
                            y3Uri.fsPath,
                        ]);
                    } else {
                        vscode.window.showWarningMessage(l10n.t('已取消初始化项目'));
                        return;
                    }
                } else {
                    await runShell(l10n.t("初始化Y3项目（Github）"), "git", [
                        "clone",
                        "https://github.com/CliCli-Editor/lualib.git",
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
                if (env.globalScriptUri) {
                    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(env.globalScriptUri, '.log'));
                }
                let copySource = vscode.Uri.joinPath(y3Uri, l10n.t('演示/项目配置'));
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

                // clone y3-maker-config 独立仓库到 .y3maker 目录
                try {
                    const y3makerTarget = vscode.Uri.joinPath(env.projectUri!, '.y3maker');
                    const configRepoUrl = getConfigRepoUrl(repoSource);
                    await runShell(l10n.t("初始化 Y3Maker 配置"), "git", [
                        "clone",
                        configRepoUrl,
                        y3makerTarget.fsPath,
                    ]);
                    // 通知 Y3Maker 重新加载 Rules/Skills/MCP（因为 openFolder 同一目录不会触发窗口重载）
                    if (webviewProvider) {
                        await webviewProvider.reloadCodemakerResources();
                    }
                } catch (e) {
                    y3.log.warn(l10n.t('克隆 y3-maker-config 失败: {0}', String(e)));
                }

                // 打开项目
                await this.context.globalState.update("NewProjectPath", scriptUri.fsPath);
                await vscode.commands.executeCommand('vscode.openFolder', env.projectUri);

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

            if (config.attachWhenLaunch) {
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
            }

            await vscode.window.withProgress({
                title: l10n.t('正在启动游戏...'),
                location: vscode.ProgressLocation.Window,
            }, async (progress) => {
                let gameLauncher = new GameLauncher();

                let suc = await gameLauncher.launch({
                    luaArgs: luaArgs,
                    multi: config.multiMode ? config.multiPlayers.sort() : undefined,
                    tracy: config.tracy,
                });

                if (!suc) {
                    return;
                }

                if (config.attachWhenLaunch) {
                    await debug.attach();
                }
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

    private async startTCPServer(silent: boolean = false): Promise<boolean> {
        try {
            this.tcpServer = new mcp.TCPServer();
            const started = await this.tcpServer.start();
            if (!started) {
                this.tcpServer.dispose();
                this.tcpServer = undefined;
                tools.log.warn('[Y3-Helper] MCP HTTP server did not bind to port 8766');
                if (!silent) {
                    vscode.window.showWarningMessage(l10n.t('MCP Server 端口 8766 已被占用，当前实例未启动'));
                }
                return false;
            }
            tools.log.info('[Y3-Helper] MCP Server started');
            // TCPServer 就绪后再启动 McpHub，避免 McpHub 连接 y3-helper:8766 时端口尚未监听
            // 确保 McpHub 已启动（注册文件监听 + 初始化 MCP servers）
            const hub = getMcpHub();
            if (hub) {
                await hub.start();
            }
            return true;
        } catch (error) {
            tools.log.error('[Y3-Helper] Failed to start MCP Server:', error);
            if (!silent) {
                vscode.window.showErrorMessage(l10n.t('启动 MCP Server 失败'));
            }
            return false;
        }
    }

    private stopTCPServer() {
        if (this.tcpServer) {
            this.tcpServer.dispose();
            this.tcpServer = undefined;
            tools.log.info('[Y3-Helper] TCP Server stopped');
        }
    }

    private async tryAutoStartMCP() {
        if (this.tcpServer || this.autoStartMCPTask) {
            return;
        }

        this.autoStartMCPTask = (async () => {
            try {
                await env.mapReady();
                if (this.tcpServer || !await this.isY3Initialized()) {
                    return;
                }
                await this.runStartupStep('startMCPServer', () => this.startTCPServer(true));
            } catch (error) {
                this.logStartupError('tryAutoStartMCP', error);
            }
        })();

        try {
            await this.autoStartMCPTask;
        } finally {
            this.autoStartMCPTask = undefined;
        }
    }

    private async hasGitDirectory(y3Uri?: vscode.Uri): Promise<boolean> {
        if (!y3Uri) {
            return false;
        }
        try {
            const gitUri = vscode.Uri.joinPath(y3Uri, '.git');
            const stat = await vscode.workspace.fs.stat(gitUri);
            return stat.type === vscode.FileType.Directory;
        } catch {
            return false;
        }
    }

    /**
     * 检查 Y3 仓库是否已初始化（.git 目录存在）。
     * 用于 MCP Server 自动启动守卫：未初始化的仓库不应自动启动 MCP。
     * 启用全局脚本后，仓库可能位于 global_script/y3。
     */
    private async isY3Initialized(): Promise<boolean> {
        if (await this.hasGitDirectory(env.y3Uri)) {
            return true;
        }
        return this.hasGitDirectory(
            env.globalScriptUri ? vscode.Uri.joinPath(env.globalScriptUri, l10n.t('y3')) : undefined
        );
    }

    private registerCommandOfMCP() {
        vscode.commands.registerCommand('y3-helper.startMCPServer', async () => {
            if (this.tcpServer) {
                vscode.window.showInformationMessage(l10n.t('MCP Server 已经在运行'));
                return;
            }
            if (await this.startTCPServer()) {
                vscode.window.showInformationMessage(l10n.t('MCP Server 已启动'));
            }
        });

        vscode.commands.registerCommand('y3-helper.stopMCPServer', () => {
            if (!this.tcpServer) {
                vscode.window.showInformationMessage(l10n.t('MCP Server 未运行'));
                return;
            }
            this.stopTCPServer();
            vscode.window.showInformationMessage(l10n.t('MCP Server 已停止'));
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

    private logStartupError(step: string, error: unknown) {
        tools.log.error(`[Y3-Helper] Startup step failed: ${step}`, error);
    }

    private async runStartupStep(step: string, action: () => Promise<unknown> | unknown): Promise<void> {
        try {
            await action();
        } catch (error) {
            this.logStartupError(step, error);
        }
    }

    public start() {
        this.registerCommandOfInitProject();
        this.registerCommandOfMakeLuaDoc();
        this.registerCommandOfLaunchGame();
        this.registerCommandOfAttach();
        this.registerCommandOfLaunchEditor();
        this.registerCommandOfMCP();

        this.reloadEnvWhenConfigChange();

        this.registerCommandOfNetworkServer();
        this.registerCommonCommands();
        this.registerCommandOfUpdateY3MakerConfig();

        // 项目切换时自动清理 MCP 连接缓存并重新初始化
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            const hub = getMcpHub();
            if (hub) {
                try {
                    await hub.resetConnections();
                } catch (error) {
                    tools.log.error('[Y3-Helper] Failed to reset MCP connections after workspace change', error);
                }
            }
        });

        env.onDidChange(() => {
            void this.tryAutoStartMCP();
        });

        setTimeout(async () => {
            await this.runStartupStep('checkNewProject', () => this.checkNewProject());
            await this.runStartupStep('mainMenu.init', () => mainMenu.init());

            // 后台检测 Y3Maker 配置更新（不阻塞激活流程）
            (async () => {
                try {
                    await env.mapReady();
                    if (!env.projectUri) {
                        return;
                    }
                    // 先检测是否需要老用户迁移
                    const migrated = await migrateOldUser(env.projectUri);
                    if (migrated && webviewProvider) {
                        await webviewProvider.reloadCodemakerResources();
                    }
                    // 检测版本更新
                    await checkForUpdates(env.projectUri);
                    // 刷新主菜单树视图，使更新节点根据状态显示/隐藏
                    mainMenu.refresh();
                } catch {
                    // 静默跳过
                }
            })();

            // 仅在 Y3 仓库已初始化后才自动启动 MCP Server（静默模式）
            await this.tryAutoStartMCP();
            await this.runStartupStep('metaBuilder.init', () => metaBuilder.init());
            await this.runStartupStep('debug.init', () => debug.init(this.context));
            await this.runStartupStep('console.init', () => console.init());
            await this.runStartupStep('editorTable.init', () => editorTable.init());
            await this.runStartupStep('plugin.init', () => plugin.init());
            await this.runStartupStep('globalScript.init', () => globalScript.init());
            await this.runStartupStep('luaLanguage.init', () => luaLanguage.init());
            await this.runStartupStep('ecaCompiler.init', () => ecaCompiler.init());
            await this.runStartupStep('y3.version.init', () => y3.version.init());
        }, 100);
    }
}

export async function activate(context: vscode.ExtensionContext) {
    let osLocale = await import('os-locale');
    y3.setContext(context);
    let language = vscode.workspace.getConfiguration('Y3-Helper').get('Language');
    if (language === 'default') {
        // VSCode的语言或系统语言任意一个是中文，则使用中文
        if (vscode.env.language === 'zh-cn' || await osLocale.osLocale() === 'zh-CN') {
            language = 'zh-cn';
        } else {
            language = 'en';
        }
    }
    env.language = language as any;
    if (language !== 'zh-cn') {
        await l10n.config({
            uri: y3.uri(context.extensionUri, 'l10n/bundle.l10n.json').toString(),
        });
    }
    let helper = new Helper(context);

    helper.start();

    // 初始化 CodeMaker 模块
    initCodeMaker(context);
}

export function deactivate() {
    stopCodeMaker();
}
