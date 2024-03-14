import * as vscode from 'vscode';
import { runShell } from './runShell';
import { LuaDocMaker } from './makeLuaDoc';
import { Env } from './env';
import { GameLauncher } from './launchGame';
import { CSVimporter } from './CSVimporter';
import * as utility from './utility';
import { TemplateGenerator } from './templateGenerator';
import { Y3HelperDataProvider } from './Y3HelperDataProvider';
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

                // 初始化CSV表
                let csvImporter = new CSVimporter(this.env);
                await csvImporter.importCSVFromOrderFolder();

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
                await vscode.debug.startDebugging(vscode.workspace.workspaceFolders?.[0], "💡附加");
            });
        });
    }

    
    /**注册从CSV格式文件中导入物体编辑数据的命令(需要用户选定文件夹)
     * @deprecated
     */
    private registerCommandOfImportObjectDataFromCSV()
    {
        vscode.commands.registerCommand('y3-helper.importObjectDataFromCSV', async () => {
            await this.env.waitReady();
            let projectUri = this.env.projectUri;
            let editorExeUri = this.env.editorExeUri;
            if (!projectUri) {
                vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
                return false;
            }
            if (!editorExeUri) {
                vscode.window.showErrorMessage("未找到编辑器！");
                return false;
            }
            await vscode.window.withProgress({
                title: '正在导入...',
                location: vscode.ProgressLocation.Window,
            }, async (progress) => {
                let csv_uri=(await utility.askUserTargetDirectory());
                console.log("csv_uri="+csv_uri?.fsPath);
                if (!csv_uri || !utility.isPathValid(csv_uri.fsPath))
                {
                    vscode.window.showErrorMessage("提供的csv文件路径非法");
                    return;
                }
                // import csv
                let csvImporter = new CSVimporter(this.env);
                let maxSearchDepth = vscode.workspace.getConfiguration("csvImpoterConfig").get<string>("max_recursive_search_depth");
                await csvImporter.recursiveSearchCSVandImport(csv_uri, 10);// 需要改动
                
            });
        });
    }

    /**
     * 根据用户配置的路径 导入全部物编数据
     */
    private registerCommandOfImportObjectDataFromAllCSVbyConfig() {
        vscode.commands.registerCommand('y3-helper.importObjectDataFromAllCSV', async () => {
            await this.env.waitReady();
            let projectUri = this.env.projectUri;
            let editorExeUri = this.env.editorExeUri;
            let scriptUri= this.env.scriptUri;
            if (!projectUri) {
                vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
                return false;
            }
            if (!editorExeUri) {
                vscode.window.showErrorMessage("未找到编辑器！");
                return false;
            }
            if (!scriptUri) {
                vscode.window.showErrorMessage("scriptUri不存在");
                return false;
            }
            await vscode.window.withProgress({
                title: '正在导入...',
                location: vscode.ProgressLocation.Window,
            }, async (progress) => {
                let csvImporter = new CSVimporter(this.env);
                await csvImporter.importCSVFromOrderFolder();

            });
        });
    }

    /**
     * 注册生成指定类型的CSV文件模板的命令
     * @deprecated
     */
    private registerCommandOfGenerateTemplateCSV() {
        vscode.commands.registerCommand('y3-helper.generateTemplateCSV', async () => {
            console.log("y3-helper.generateTemplateCSV");
            await this.env.waitReady();
            let projectUri = this.env.projectUri;
            let editorExeUri = this.env.editorExeUri;
            if (!projectUri) {
                vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
                return false;
            }
            if (!editorExeUri) {
                vscode.window.showErrorMessage("未找到编辑器！");
                return false;
            }
            // todo: 生成csv模板
            let templateGenerator = new TemplateGenerator(this.env);
            let targetUri=await utility.askUserTargetDirectory();
            if (!targetUri) {
                vscode.window.showErrorMessage("指定的路径不存在");
                return;
            }
            
            const items: vscode.QuickPickItem[] = [
                { label: '单位', description: 'unit' },
                { label: '装饰物', description: 'decoration' },
                { label: '物品', description: 'item' },
                { label: '技能', description: 'ability' },
                { label: '魔法效果', description: 'modifier' },
                { label: '投射物', description: 'projectile' },
                { label: '科技', description: 'technology' },
                { label: '可破坏物', description: 'destructible' },
            ];

            vscode.window.showQuickPick(items, {
                placeHolder: '选择你要生成的模板类型'
            }).then(selection => {
                if (selection) {
                    vscode.window.showInformationMessage(`你选择了: ${selection.label}`);
                }
                let templateGenerator: TemplateGenerator = new TemplateGenerator(this.env);
                if (selection?.description!==undefined&&targetUri!==undefined) {
                    templateGenerator.generateTemplateCSVToTargetPath(selection.label, vscode.Uri.joinPath(targetUri, selection.label));
                }
                else {
                    vscode.window.showErrorMessage(`selection?.description===undefined||targetUri===undefined`);
                    return;
                }
                vscode.window.showInformationMessage(`${selection.label}数据模板生成成功`);
            });

        });
    }

    private registerCommandOfGenerateAllTemplateCSV() {
        vscode.commands.registerCommand('y3-helper.generateAllTemplateCSV', async () => {
            console.log("y3-helper.generateTemplateCSV");
            await this.env.waitReady();
            let projectUri = this.env.projectUri;
            let editorExeUri = this.env.editorExeUri;
            if (!projectUri) {
                vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
                return false;
            }
            if (!editorExeUri) {
                vscode.window.showErrorMessage("未找到编辑器！");
                return false;
            }
            if (!this.env.scriptUri) {
                vscode.window.showErrorMessage("未找到script文件夹");
                return false;
            }
            // todo: 生成csv模板
            let templateGenerator = new TemplateGenerator(this.env);
            
            let targetUri: vscode.Uri = vscode.Uri.joinPath(this.env.scriptUri,"./resource/editor_table/"); 
            await templateGenerator.generateAllTemplateCSVtoTargetPath(targetUri);
               
        });
    }

    private registerCommandOfOpenFile() {
        vscode.commands.registerCommand('y3-helper.openFile', async (fileUri: vscode.Uri) => {
            const document = await vscode.workspace.openTextDocument(fileUri.fsPath);
            vscode.window.showTextDocument(document);
        });
    }

    private registerCommandOfClickY3HelperContainer() {
        vscode.commands.registerCommand('y3-helper.clickY3-Helper-container', async () => {
            this.registerY3HelperDataProvider();
            console.log("y3-helper.clickY3-Helper-container");
        });
    }

    private registerY3HelperDataProvider() {
        vscode.window.registerTreeDataProvider(
            'y3-Helper.editorTableViewer',
            new Y3HelperDataProvider(this.env)
        );
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
        this.registerCommandOfImportObjectDataFromAllCSVbyConfig();
        this.registerCommandOfGenerateAllTemplateCSV();

        this.registerY3HelperDataProvider();
        this.registerCommandOfOpenFile();
        
        this.checkNewProject();
        this.reloadEnvWhenConfigChange();
    }
}

export function activate(context: vscode.ExtensionContext) {
    let helper = new Helper(context);

    helper.start();
}

export function deactivate() {}
