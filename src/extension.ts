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
                if (env.language === 'zh-cn') {
                    let result = await vscode.window.showInformationMessage(l10n.t('请选择仓库来源：'),
                    {
                        modal: true,
                    }, optionsGithub, optionsGitee);

                    if (result === optionsGithub) {
                        // 从github上 clone 项目，地址为 “https://github.com/y3-editor/y3-lualib”
                        await runShell(l10n.t("初始化Y3项目（Github）"), "git", [
                            "clone",
                            "https://github.com/y3-editor/y3-lualib.git",
                            y3Uri.fsPath,
                        ]);
                    } else if (result === optionsGitee)  {
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

                // 复制 y3-lualib 中的 .y3maker 到工程根目录（包含 skills、rules、knowledge、mcp_settings.json）
                try {
                    let codemakerSource = vscode.Uri.joinPath(y3Uri, '.y3maker');
                    let codemakerTarget = vscode.Uri.joinPath(env.projectUri!, '.y3maker');
                    await vscode.workspace.fs.copy(codemakerSource, codemakerTarget, { overwrite: true });
                    // 删除 y3-lualib 中的 .y3maker，只保留地图根目录下的
                    await vscode.workspace.fs.delete(codemakerSource, { recursive: true });
                    // 通知 Y3Maker 重新加载 Rules/Skills/MCP（因为 openFolder 同一目录不会触发窗口重载）
                    if (webviewProvider) {
                        await webviewProvider.reloadCodemakerResources();
                    }
                } catch (e) {
                    y3.log.warn(l10n.t('复制 .y3maker 目录失败: {0}', String(e)));
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

    // .codemaker → .y3maker 自动迁移（在 projectUri 就绪后执行）
    // 因为 helper.start() 是异步的，projectUri 在此时可能还未设置
    // 所以需要监听 env 变化事件，在 projectUri 首次就绪时执行迁移
    let migrated = false;
    const tryMigrate = async () => {
        if (migrated) { return; }
        if (y3.env?.projectUri) {
            migrated = true;
            await migrateCodemakerToY3maker();
        }
    };
    // 立即尝试一次（如果 projectUri 已经就绪）
    await tryMigrate();
    // 监听环境变化，projectUri 设置后再尝试
    if (!migrated) {
        const disposable = y3.env.onDidChange(async () => {
            await tryMigrate();
            if (migrated) {
                disposable.dispose();
                // 迁移完成后，通知 webview 重新加载资源
                if (webviewProvider) {
                    await webviewProvider.reloadCodemakerResources();
                }
            }
        });
        context.subscriptions.push(disposable);
    }

    // 初始化 CodeMaker 模块
    initCodeMaker(context);
}

export function deactivate() {
    stopCodeMaker();
}

/**
 * 自动迁移 .codemaker → .y3maker 目录和 .codemaker.codebase.md → .y3maker.codebase.md 文件
 * 在 initCodeMaker 之前调用，确保 webview 加载 rules/skills 时目录已就绪
 */
async function migrateCodemakerToY3maker() {
    const projectUri = y3.env?.projectUri;
    if (!projectUri) {
        return;
    }

    // 迁移 .codemaker 目录 → .y3maker
    const oldDir = vscode.Uri.joinPath(projectUri, '.codemaker');
    const newDir = vscode.Uri.joinPath(projectUri, '.y3maker');

    // 先检查 .codemaker 是否存在
    let oldDirExists = false;
    try {
        await vscode.workspace.fs.stat(oldDir);
        oldDirExists = true;
    } catch {
        // .codemaker 不存在，无需迁移
    }

    if (oldDirExists) {
        // 检查 .y3maker 是否已存在
        let newDirExists = false;
        let newDirIsEmpty = false;
        try {
            const entries = await vscode.workspace.fs.readDirectory(newDir);
            newDirExists = true;
            // 判断是否为"空目录"（只有 MCP 自动创建的 mcp_settings.json 也算空）
            newDirIsEmpty = entries.length === 0
                || (entries.length === 1 && entries[0][0] === 'mcp_settings.json');
        } catch {
            // .y3maker 不存在
        }

        if (!newDirExists) {
            // .y3maker 不存在，复制 .codemaker 到 .y3maker（保留原目录）
            try {
                await vscode.workspace.fs.copy(oldDir, newDir, { overwrite: false });
                y3.log.info('已自动将 .codemaker 目录复制为 .y3maker');
            } catch (e) {
                vscode.window.showWarningMessage(
                    `无法自动将 .codemaker 目录复制为 .y3maker，请手动复制。错误: ${String(e)}`
                );
            }
        } else if (newDirIsEmpty) {
            // .y3maker 存在但是空的（可能被 MCP 初始化自动创建），先删除再复制
            try {
                await vscode.workspace.fs.delete(newDir, { recursive: true });
                await vscode.workspace.fs.copy(oldDir, newDir, { overwrite: false });
                y3.log.info('已自动将 .codemaker 目录复制为 .y3maker（覆盖了空的 .y3maker）');
            } catch (e) {
                vscode.window.showWarningMessage(
                    `无法自动将 .codemaker 目录复制为 .y3maker，请手动复制。错误: ${String(e)}`
                );
            }
        } else {
            // .y3maker 已存在且有内容，不迁移
            y3.log.info('.y3maker 目录已存在且有内容，跳过 .codemaker 迁移');
        }
    }

    // 迁移 .codemaker.codebase.md 文件 → .y3maker.codebase.md
    const oldFile = vscode.Uri.joinPath(projectUri, '.codemaker.codebase.md');
    const newFile = vscode.Uri.joinPath(projectUri, '.y3maker.codebase.md');
    try {
        await vscode.workspace.fs.stat(newFile);
        // .y3maker.codebase.md 已存在，无需迁移
    } catch {
        try {
            await vscode.workspace.fs.stat(oldFile);
            try {
                await vscode.workspace.fs.copy(oldFile, newFile, { overwrite: false });
                y3.log.info('已自动将 .codemaker.codebase.md 复制为 .y3maker.codebase.md');
            } catch (e) {
                y3.log.warn(`无法复制 .codemaker.codebase.md: ${String(e)}`);
            }
        } catch {
            // 旧文件不存在，跳过
        }
    }
}
