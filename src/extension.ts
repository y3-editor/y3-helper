import * as vscode from 'vscode';
import { runShell } from './runShell';
import { LuaDocMaker } from './makeLuaDoc';
import { Env } from './env';
import { GameLauncher } from './launchGame';

class Helper {
    private context: vscode.ExtensionContext;
    private logger: vscode.OutputChannel;
    private env: Env;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.logger = vscode.window.createOutputChannel("Y3 - Helper", { log: true });
        this.logger.clear();

        this.env = new Env(this.logger);
    }

    private registerCommandOfInitProject() {
        let disposable = vscode.commands.registerCommand('y3-helper.initProject', async () => {
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
                try {
                    let state = await vscode.workspace.fs.stat(y3Uri);
                    if (state.type === vscode.FileType.Directory) {
                        // 直接删除这个目录
                        try {
                            await vscode.workspace.fs.delete(y3Uri, {
                                recursive: true,
                                useTrash: true,
                            });
                            this.logger.appendLine(`已将原有的 ${y3Uri.fsPath} 目录移至回收站`);
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
                    await vscode.workspace.fs.copy(
                        vscode.Uri.joinPath(copySource, entry[0]),
                        vscode.Uri.joinPath(scriptUri, entry[0]),
                    );
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

    private regsiterTaskOfLaunchGame() {
        vscode.tasks.registerTaskProvider("y3-helper", {
            provideTasks: () => {
                let task = new vscode.Task(
                    { type: "y3-helper", task: "launch" },
                    vscode.TaskScope.Workspace,
                    "运行地图",
                    "Launch Game",
                    new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
                        return {
                            onDidWrite: () => { return new vscode.Disposable(() => {}); },
                            close: () => {},
                            open: async () => {
                                //await launchGame();
                            },
                        };
                    }),
                    "",
                );
                return [task];
            },
            resolveTask: (task) => {
                return task;
            },
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
        this.regsiterTaskOfLaunchGame();

        this.checkNewProject();
    }
}

export function activate(context: vscode.ExtensionContext) {
    let helper = new Helper(context);

    helper.start();
}

export function deactivate() {}
