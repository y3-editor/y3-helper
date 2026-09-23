import moduleAlias from 'module-alias';

moduleAlias.addAliases({
    'y3-helper': __dirname + '/y3-helper'
});

import * as tools from "./tools";
import * as vscode from 'vscode';
import * as mainMenu from './mainMenu';

import { env } from './env';
import { runShell } from './runShell';
import {
    getConfigRepoUrl, checkForUpdates, performUpdate, forceRemoteUpdate, clearCachedUpdateStatus,
    getCachedUpdateStatus, getCloneY3MakerPreference, getY3MakerDirState,
    listY3MakerEntries, mergeY3MakerFromRemote, replaceY3MakerFromRemote, cloneY3MakerIfMissing,
    releaseY3MakerWatchers,
} from './y3makerConfig';
import { LuaDocMaker } from './makeLuaDoc';
import { GameLauncher } from './launchGame';
import { NetworkServer } from './networkServer';
import * as console from './console';
import * as metaBuilder from './metaBuilder';
import * as debug from './debug';
import { EditorLauncher } from './launchEditor';
import { killGame } from './killGame';
import { initLaunchAgent, shutdownLaunchAgent } from './launchAgent/manager';
import * as editorTable from './editorTable';
import * as plugin from './plugin';
import * as y3 from 'y3-helper';
import { config } from './config';
import * as cloudScript from './cloudScript';
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
    private mcpDefinitionProvider?: mcp.McpDefinitionProvider;

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
            // 只有我们自己的仓库才 pull，别把用户自己的仓库搞乱
            if (await getY3MakerDirState(env.projectUri) !== 'managed') {
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

    /**
     * 按用户偏好决定是否把 y3-maker-config 克隆到 .y3maker。
     * 只有用户主动初始化项目时才会走到这里，所以可以弹窗询问。
     * 注意：弹窗里的选择只对这一次生效，不会去改偏好——想“以后别再问”由用户自己在设置里改。
     */
    private async cloneY3MakerConfig(repoSource: 'github' | 'gitee'): Promise<boolean> {
        const preference = getCloneY3MakerPreference();
        let shouldClone = preference === 'always';

        if (preference === 'ask') {
            const cloneOption = l10n.t('拉取');
            // 模态框本来就自带一个“取消”（VS Code 补的），所以这里只给正向选项
            const choice = await vscode.window.showInformationMessage(
                l10n.t('要拉取 Y3Maker 配置吗？'),
                {
                    modal: true,
                    detail: l10n.t('会在项目根目录创建 .y3maker，用来存放规则、技能和 MCP 配置。想让以后的项目不再问，可在设置里改 CloneY3MakerConfig。'),
                },
                cloneOption,
            );
            // 只有明确点「拉取」才拉；取消/关窗都是本次不拉，也都不改偏好
            shouldClone = choice === cloneOption;
        }

        if (!shouldClone) {
            vscode.window.showInformationMessage(l10n.t('已跳过 Y3Maker 配置。可点主菜单的“Y3Maker 配置未初始化”拉取，或在设置里改 CloneY3MakerConfig。'));
            return false;
        }

        return await this.pullY3MakerConfig(getConfigRepoUrl(repoSource));
    }

    /**
     * 用户主动触发的拉取：按 .y3maker 当前状态决定怎么做。
     * - missing：直接 clone（没有任何东西会丢）
     * - partial：弹窗三选一（合并 / 备份并替换 / 稍后再说）
     * - managed：已经是我们管的仓库，无事可做
     * - foreign：不是我们的仓库，绝不碰
     * 启动后台不走这里：那里的规则是“永不弹窗、只做增量动作”。
     */
    private async pullY3MakerConfig(repoUrl: string): Promise<boolean> {
        const projectUri = env.projectUri;
        if (!projectUri) {
            return false;
        }

        const state = await getY3MakerDirState(projectUri);
        if (state === 'managed') {
            return true;
        }
        if (state === 'foreign') {
            vscode.window.showWarningMessage(l10n.t('.y3maker 已经是一个 git 仓库，但不是 Y3Maker 的配置仓库，已跳过。'));
            return false;
        }

        let action: 'merge' | 'replace' = 'replace';
        if (state === 'partial') {
            const choice = await this.askPartialAction(projectUri);
            if (!choice) {
                return false;
            }
            action = choice;
        }

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: l10n.t('正在拉取 Y3Maker 配置...'),
        }, async () => {
            // 目录存在时可能有 SkillsHandler / McpHub 在监听，先松开再动它
            if (state === 'partial') {
                releaseY3MakerWatchers();
            }

            const result = action === 'merge'
                ? await mergeY3MakerFromRemote(projectUri, repoUrl)
                : await replaceY3MakerFromRemote(projectUri, repoUrl);

            if (!result.ok) {
                vscode.window.showWarningMessage(l10n.t('拉取 Y3Maker 配置失败，请检查网络或 git 环境。'));
                mainMenu.refresh();
                return false;
            }

            // 通知 Y3Maker 重新加载 Rules/Skills/MCP（因为 openFolder 同一目录不会触发窗口重载）
            if (webviewProvider) {
                await webviewProvider.reloadCodemakerResources();
            }
            if (action === 'merge') {
                vscode.window.showInformationMessage(l10n.t('已合并：补上了缺少的文件，你的文件没动。'));
            } else {
                vscode.window.showInformationMessage(result.backupDir
                    ? l10n.t('拉取成功，原内容已备份到 {0}', result.backupDir)
                    : l10n.t('Y3Maker 配置拉取完成。'));
            }
            mainMenu.refresh();
            return true;
        });
    }

    /**
     * partial 状态下的三选一。返回 undefined 表示用户选了“稍后再说”。
     */
    private async askPartialAction(projectUri: vscode.Uri): Promise<'merge' | 'replace' | undefined> {
        const mergeOption = l10n.t('合并');
        const replaceOption = l10n.t('备份并替换');

        const entries = await listY3MakerEntries(projectUri);
        const found = entries.length === 0
            ? l10n.t('目录是空的')
            : l10n.t('里面现有 {0} 项：{1}', String(entries.length), entries.slice(0, 6).join('、'));

        // 取消（模态框自带）＝ 先不动
        const choice = await vscode.window.showInformationMessage(
            l10n.t('.y3maker 已存在，但不是 git 仓库。要怎么处理？'),
            {
                modal: true,
                detail: l10n.t('{0}\n\n合并：保留你的文件，只补缺少的。\n备份并替换：先把原目录备份成带时间戳的新目录，再放一份干净的。\n取消：先不动，主菜单里会留着入口。', found),
            },
            mergeOption,
            replaceOption,
        );

        if (choice === mergeOption) {
            return 'merge';
        }
        if (choice === replaceOption) {
            return 'replace';
        }
        return undefined;
    }

    private registerCommandOfCloneY3MakerConfig() {
        vscode.commands.registerCommand('y3-helper.cloneY3MakerConfig', async () => {
            const projectUri = env.projectUri;
            if (!projectUri) {
                return;
            }
            // 手动拉取时不替用户猜来源：Gitee 镜像拉不到仓库里的大文件，
            // 所以让用户自己选（后台自动补齐那条路没法问，才用 detectRepoUrl 推断）。
            const repoSource = await this.askY3MakerConfigSource();
            if (!repoSource) {
                return;
            }
            await this.pullY3MakerConfig(getConfigRepoUrl(repoSource));
        });
    }

    /** 手动拉取前问一次从哪拉；返回 undefined 表示用户取消 */
    private async askY3MakerConfigSource(): Promise<'github' | 'gitee' | undefined> {
        const githubOption = l10n.t('Github（可能需要代理）');
        const giteeOption = l10n.t('Gitee（国内镜像）');

        // 取消交给模态框自带的那个按钮（再放一个就成了两个“取消”）
        const choice = await vscode.window.showInformationMessage(
            l10n.t('从哪里拉取 Y3Maker 配置？'),
            { modal: true },
            githubOption,
            giteeOption,
        );

        if (choice === githubOption) {
            return 'github';
        }
        if (choice === giteeOption) {
            return 'gitee';
        }
        return undefined;
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
                // 启用全局脚本后 Y3 库位于 global_script/y3
                let y3Uri = env.y3RepoUri;
                if (!y3Uri) {
                    vscode.window.showErrorMessage(l10n.t('未找到Y3脚本库路径！'));
                    return;
                }

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

                // 启用全局脚本时，Y3 库只应存在于全局目录。地图里残留的那份
                // 会因为“地图脚本优先于全局脚本”而覆盖全局，必须移除。
                if (env.globalScriptEnabled) {
                    for (const map of env.project?.maps ?? []) {
                        let mapY3Uri = map.y3Uri;
                        if (!await y3.fs.isExists(mapY3Uri)) {
                            continue;
                        }
                        await y3.fs.removeFile(mapY3Uri, {
                            recursive: true,
                            useTrash: true,
                        });
                        vscode.window.showInformationMessage(l10n.t('已将原有的 {0} 目录移至回收站', mapY3Uri.fsPath));
                    }
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

                // clone y3-maker-config 独立仓库到 .y3maker 目录（是否自动拉取由用户决定）
                await this.cloneY3MakerConfig(repoSource);

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
            cloudScript.cancelAutoAttach();
            let luaArgs: Record<string, string> = {};

            if (config.tracy) {
                luaArgs['lua_tracy'] = 'true';
            }

            if (config.attachWhenLaunch) {
                if (config.multiMode) {
                    const selectedPlayers = [...config.multiPlayers].sort((a, b) => a - b);
                    const selectedPlayerIds = new Set(selectedPlayers);
                    luaArgs['lua_multi_mode'] = 'true';
                    luaArgs['lua_multi_wait_debugger'] = 'true';
                    luaArgs['lua_multi_debug_players'] = config.debugPlayers
                        .filter((id) => selectedPlayerIds.has(id))
                        .sort((a, b) => a - b)
                        .join('#');
                    if (selectedPlayers.length === 0) {
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
                let cloudScriptAttach: cloudScript.CloudScriptAutoAttachOperation | undefined;
                try {
                    if (config.attachCloudScriptWhenLaunch && !config.multiMode) {
                        cloudScriptAttach = await cloudScript.beginAutoAttach();
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(String(error));
                    return;
                }

                let suc: boolean;
                try {
                    suc = await gameLauncher.launch({
                        luaArgs: luaArgs,
                        multi: config.multiMode ? [...config.multiPlayers].sort((a, b) => a - b) : undefined,
                        multiNicknames: config.multiMode ? {...config.multiPlayerNicknames} : undefined,
                        tracy: config.tracy,
                    });
                } catch (error) {
                    cloudScriptAttach?.cancel();
                    throw error;
                }

                if (!suc) {
                    cloudScriptAttach?.cancel();
                    return;
                }

                await Promise.all([
                    config.attachWhenLaunch ? debug.attach() : Promise.resolve(true),
                    cloudScriptAttach?.completion ?? Promise.resolve(true),
                ]);
            });
        });
    }

    private registerCommandOfKillGame() {
        vscode.commands.registerCommand('y3-helper.killGame', async () => {
            await killGame();
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
        this.context.subscriptions.push(
            vscode.commands.registerCommand('y3-helper.enableCloudScriptDebug', () => cloudScript.enable()),
            vscode.commands.registerCommand('y3-helper.removeCloudScriptDebug', async () => {
                await cloudScript.remove();
                mainMenu.refresh();
            }),
        );
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
            this.mcpDefinitionProvider?.refresh();
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
            this.mcpDefinitionProvider?.refresh();
            tools.log.info('[Y3-Helper] TCP Server stopped');
        }
    }

    private registerMcpServerDefinitionProvider() {
        const provider = new mcp.McpDefinitionProvider(() => !!this.tcpServer);
        this.mcpDefinitionProvider = provider;
        this.context.subscriptions.push(provider, provider.register());
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
     * 启用全局脚本后，仓库位于 global_script/y3（由 env.y3RepoUri 统一给出）。
     */
    private async isY3Initialized(): Promise<boolean> {
        return this.hasGitDirectory(env.y3RepoUri);
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

        vscode.commands.registerCommand('y3-helper.showMcpDoc', async () => {
            const document = await vscode.workspace.openTextDocument({
                language: 'markdown',
                content: mcp.MCP_DOC,
            });
            await vscode.window.showTextDocument(document);
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
        this.registerCommandOfKillGame();
        this.registerCommandOfAttach();
        this.registerCommandOfLaunchEditor();
        this.registerCommandOfMCP();
        this.registerMcpServerDefinitionProvider();

        this.reloadEnvWhenConfigChange();

        this.registerCommandOfNetworkServer();
        this.registerCommonCommands();
        this.registerCommandOfUpdateY3MakerConfig();
        this.registerCommandOfCloneY3MakerConfig();

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

            // 后台检测 Y3Maker 配置更新 + MCP 启动（需保证 .y3maker 的恢复在 MCP 前完成，否则 McpHub 会误创建 .y3maker 目录）
            (async () => {
                try {
                    await env.mapReady();
                    if (!env.project) {
                        return;
                    }
                    // 先做 .y3maker 的恢复，必须在 MCP 启动前完成。
                    // 后台只做增量动作：目录不存在、且偏好为 always 时才 clone。
                    // partial（需要用户决策）和 foreign（不是我们的仓库）一律不碰，
                    // 免得静默覆盖用户目录（提示交给主菜单节点）。
                    let cloned = false;
                    if (getCloneY3MakerPreference() === 'always') {
                        cloned = await cloneY3MakerIfMissing(env.projectUri!);
                    }
                    if (cloned && webviewProvider) {
                        await webviewProvider.reloadCodemakerResources();
                    }
                    // 检测版本更新
                    await checkForUpdates(env.projectUri!);
                    // 刷新主菜单树视图，使更新节点根据状态显示/隐藏
                    mainMenu.refresh();
                } catch {
                    // 静默跳过
                }

                // 仅在 Y3 仓库已初始化后才自动启动 MCP Server（静默模式）
                await this.tryAutoStartMCP();
            })();

            // 先确定全局脚本是否启用，后面的产物（meta/插件等）依赖它决定落点
            await this.runStartupStep('globalScript.init', () => globalScript.init());
            await this.runStartupStep('metaBuilder.init', () => metaBuilder.init());
            await this.runStartupStep('debug.init', () => debug.init(this.context));
            await this.runStartupStep('cloudScript.init', () => cloudScript.init(this.context));
            await this.runStartupStep('console.init', () => console.init());
            await this.runStartupStep('editorTable.init', () => editorTable.init());
            await this.runStartupStep('plugin.init', () => plugin.init());
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

    initLaunchAgent(context);
}

export function deactivate() {
    shutdownLaunchAgent();
    stopCodeMaker();
}
