import * as vscode from 'vscode';
import { runShell } from './runShell';
import { LuaDocMaker } from './makeLuaDoc';
import { Env } from './env';
import { GameLauncher } from './launchGame';
import * as https from 'https';
import * as JSZip from 'jszip';
import * as fs from 'fs';

class Helper {
    private context: vscode.ExtensionContext;
    private logger: vscode.LogOutputChannel;
    private env: Env;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.logger = vscode.window.createOutputChannel("Y3开发助手", { log: true });
        this.logger.clear();

        this.env = new Env(this.logger);
    }

    private reloadEnvWhenConfigChange() {
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('Y3-Helper.EditorPath')) {
                this.env = new Env(this.logger);
                this.logger.info('配置已更新，已重新加载环境');
            }
        });
    }

    private registerCommandOfInitProject() {
        vscode.commands.registerCommand('y3-helper.initProject', async () => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在初始化Y3项目...',
            }, async (progress, token) => {
                await this.env.waitReady();
                if (!this.env.scriptUri) {
                    vscode.window.showErrorMessage('未找到地图路径，请先用编辑器创建地图！');
                    return;
                };

                let scriptUri = this.env.scriptUri!;
                let y3Uri = this.env.y3Uri!;
                let ui_path = vscode.Uri.joinPath(this.env.projectUri!, 'ui_plugin');
                await https.get('https://up5.nosdn.127.net/editor/zip/edc461b312fc308779be9273a2cee6bb', (resp) => {
                    // 收到数据
                    const chunks: any[] = [];
                    resp.on('data', (chunk) => {
                        chunks.push(chunk);
                    });
                    // 数据接收完毧
                    resp.on('end', () => {
                        // 将所有数据块拼接在一起
                        const data = Buffer.concat(chunks);
                        // 加压到目标文件夹
                        JSZip.loadAsync(data).then((zip) => {
                            zip.forEach((relativePath, file) => {
                                if(file.dir){
                                    fs.mkdirSync(vscode.Uri.joinPath(ui_path, relativePath).fsPath, {recursive: true});
                                }
                                else{
                                    file.async('nodebuffer').then((content) => {
                                        fs.writeFileSync(vscode.Uri.joinPath(ui_path, relativePath).fsPath, content);
                                    });
                                }
                            });
                            console.log('ZIP 数据已解压缩到文件系统');
                        });
                    });
                }).on("error", (err) => {
                    console.log("download ui error" + err.message);
                });


                try {
                    let state = await vscode.workspace.fs.stat(y3Uri);
                    if (state.type === vscode.FileType.Directory) {
                        // 直接删除这个目录
                        try {
                            await vscode.workspace.fs.delete(y3Uri, {
                                recursive: true,
                                useTrash: true,
                            });
                            this.logger.info(`已将原有的 ${y3Uri.fsPath} 目录移至回收站`);
                        } catch (error) {
                            vscode.window.showErrorMessage(`${y3Uri.fsPath} 已被占用，请手动删除它！`);
                            return;
                        }
                    } else {
                        vscode.window.showErrorMessage(`${y3Uri.fsPath} 已被占用，请手动删除它！`);
                        return;
                    };
                } catch (error) {
                    // ignore
                }

                vscode.workspace.fs.createDirectory(y3Uri);

                // 从github上 clone 项目，地址为 “https://github.com/y3-editor/y3-lualib”
                await runShell("初始化Y3项目", "git", [
                    "clone",
                    "https://github.com/y3-editor/y3-lualib.git",
                    y3Uri.fsPath,
                ]);

                // 如果clone失败，则尝试从备用地址 clone 项目，地址为 “https://gitee.com/tsukiko/y3-lualib”
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.joinPath(y3Uri, 'README.md'));
                } catch {
                    await runShell("初始化Y3项目（备用地址）", "git", [
                        "clone",
                        "https://gitee.com/tsukiko/y3-lualib.git",
                        y3Uri.fsPath,
                    ]);
                }

                // 检查编辑器版本，如果是 1.0 版本则切换到 1.0 分支
                let editorVersion = this.env.editorVersion;
                if (editorVersion === '1.0') {
                    await runShell("初始化Y3项目", "git", [
                        "checkout",
                        "-b",
                        "1.0",
                        "origin/1.0"
                    ], y3Uri);
                }

                // 初始化配置
                await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(scriptUri, 'log'));
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
                this.context.globalState.update("NewProjectPath", scriptUri.fsPath);
                await vscode.commands.executeCommand('vscode.openFolder', scriptUri);
            });
        });
    }

    private registerCommandOfMakeLuaDoc() {
        vscode.commands.registerCommand('y3-helper.makeLuaDoc', async () => {
            await vscode.window.withProgress({
                title: '正在生成文档...',
                location: vscode.ProgressLocation.Window,
            }, async (progress) => {
                let luaDocMaker = new LuaDocMaker(this.context);
                await luaDocMaker.make();
            });
        });
    }

    private registerCommandOfLaunchGame() {
        vscode.commands.registerCommand('y3-helper.launchGame', async () => {
            await vscode.window.withProgress({
                title: '正在启动游戏...',
                location: vscode.ProgressLocation.Window,
            }, async (progress) => {
                let gameLauncher = new GameLauncher(this.env);
                await gameLauncher.launch();
            });
        });
    }

    private registerCommandOfLaunchGameAndAttach() {
        vscode.commands.registerCommand('y3-helper.launchGameAndAttach', async () => {
            await vscode.window.withProgress({
                title: '正在启动游戏...',
                location: vscode.ProgressLocation.Window,
            }, async (progress) => {
                let gameLauncher = new GameLauncher(this.env);
                let suc = gameLauncher.launch();
                if (!suc) {
                    return;
                }

                await this.env.waitReady();
                const logUri = vscode.Uri.joinPath(this.env.scriptUri!, 'log');
                const waitdbgUri = vscode.Uri.joinPath(logUri, 'waitdbg');
                try {
                    await vscode.workspace.fs.createDirectory(logUri);
                    await vscode.workspace.fs.writeFile(waitdbgUri, new Uint8Array(0));
                } catch (error) { }
                await vscode.debug.startDebugging(vscode.workspace.workspaceFolders?.[0], "💡附加");
                try {
                    if ((await vscode.workspace.fs.stat(waitdbgUri)).type === vscode.FileType.File) {
                        await vscode.workspace.fs.delete(waitdbgUri);
                    };
                } catch (error) { }
            });
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
                vscode.window.showInformationMessage("欢迎使用Y3编辑器！");
            });
        };
    }

    public start() {
        this.registerCommandOfInitProject();
        this.registerCommandOfMakeLuaDoc();
        this.registerCommandOfLaunchGame();
        this.registerCommandOfLaunchGameAndAttach();

        this.checkNewProject();
        this.reloadEnvWhenConfigChange();
    }
}

export function activate(context: vscode.ExtensionContext) {
    let helper = new Helper(context);

    helper.start();
}

export function deactivate() {}
