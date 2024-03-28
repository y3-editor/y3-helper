import * as vscode from 'vscode';
import { runShell } from './runShell';
import { LuaDocMaker } from './makeLuaDoc';
import { Env } from './env';
import { GameLauncher } from './launchGame';
import { CSVimporter } from './editorTable/CSVimporter';
import * as utility from './utility';
import { TemplateGenerator } from './editorTable/templateGenerator';
import { EditorTableDataProvider, GoEditorTableSymbolProvider, GoEditorTableDocumentSymbolProvider } from './editorTable/editorTable';
import * as tools from "./tools";
import * as preset from './preset';
import { englishPathToChinese } from './constants';
import { CSVeditor } from './editorTable/CSVeditor';
import { MainMenu } from './mainMenu';

class Helper {
    private context: vscode.ExtensionContext;
    private env: Env;
    private mainMenu: MainMenu;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        this.env = new Env();
        this.mainMenu = new MainMenu(this.env);
    }

    private async reload(waitReady = false) {
        this.env = new Env();
        if (waitReady) {
            await this.env.waitReady();
        }
        this.mainMenu.reload(this.env);
    }

    private reloadEnvWhenConfigChange() {
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('Y3-Helper.EditorPath')) {
                await this.reload();
                tools.log.info('配置已更新，已重新加载环境');
            }
        });
    }

    private registerCommonCommands() {
        vscode.commands.registerCommand('y3-helper.reloadEnv', async () => {
            await this.reload(true);
        });
        vscode.commands.registerCommand('y3-helper.shell', async (...args: any[]) => {
            runShell("执行命令", args[0], args.slice(1));
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
                title: '正在初始化Y3项目...',
            }, async (progress, token) => {
                await this.env.waitReady();
                if (!this.env.scriptUri) {
                    vscode.window.showErrorMessage('未找到Y3地图路径，请先用编辑器创建地图或重新指定！');
                    return;
                };

                let scriptUri = this.env.scriptUri!;
                let y3Uri = this.env.y3Uri!;

                try {
                    if ((await vscode.workspace.fs.stat(vscode.Uri.joinPath(y3Uri, '.git'))).type === vscode.FileType.Directory) {
                        vscode.window.showErrorMessage('此项目已经初始化过了！');
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
                            vscode.window.showInformationMessage(`已将原有的 ${y3Uri.fsPath} 目录移至回收站`);
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
                await vscode.commands.executeCommand('y3-helper.generateAllTemplateCSV');

                // 下载预设UI
                await vscode.commands.executeCommand('y3-helper.downloadPresetUI');

                // 打开项目
                this.context.globalState.update("NewProjectPath", scriptUri.fsPath);
                await vscode.commands.executeCommand('vscode.openFolder', scriptUri);

                this.mainMenu.reload(this.env);
            });
            running = false;
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
                let suc = gameLauncher.launch({
                    "lua_wait_debugger": true,
                });
                if (!suc) {
                    return;
                }

                await this.env.waitReady();
                await vscode.debug.startDebugging(vscode.workspace.workspaceFolders?.[0], "💡附加");
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
     * 注册CSVeditor相关的命令
     */
    private registerCommandOfCSVeditor() {
        
        // 在CSV表格中添加物编项目的命令
        let addNewDataInCSVcommand = vscode.commands.registerCommand('y3-helper.addNewDataInCSV', async () => {
            await this.env.waitReady();
            const editorTableTypes: vscode.QuickPickItem[] = [
                { label: '单位', description: 'unit' },
                { label: '装饰物', description: 'decoration' },
                { label: '物品', description: 'item' },
                { label: '技能', description: 'ability' },
                { label: '魔法效果', description: 'modifier' },
                { label: '投射物', description: 'projectile' },
                { label: '科技', description: 'technology' },
                { label: '可破坏物', description: 'destructible' },
                { label: '声音', description: 'sound' }
            ];
            vscode.window.showQuickPick(editorTableTypes, {
                placeHolder: '选择你要添加的物编数据类型(CSV)'
            }).then(selection => {
                if (selection) {
                    vscode.window.showInformationMessage(`你选择了: ${selection.label}`);
                }
                
                const inputOptions: vscode.InputBoxOptions = {
                    prompt: '名称',
                    placeHolder: '字符串',
                    validateInput: (text: string) => {
                        if (text.length === 0) {
                            return "输入的内容为空";
                        }
                        return null;
                    }
                };
                vscode.window.showInputBox(inputOptions).then(value => {
                    if (value) {
                        
                        
                        // todo:分配一个uid并新建到csv中

                    }
                });
            });
        });
        this.context.subscriptions.push(addNewDataInCSVcommand);

        // 把Y3工程项目中已有的物编数据的UID和名称添加到CSV表格以便填写和导入的命令
        let addUIDandNameToCSVfromProjectCommand = vscode.commands.registerCommand("y3-helper.addUIDandNameToCSVfromProject", async () => {
            await this.env.waitReady();
            const inputOptions: vscode.InputBoxOptions = {
                prompt: 'UID或名称',
                placeHolder: 'UID或名称',
                validateInput: (text: string) => {
                    if (text.length === 0) {
                        return "输入的内容为空";
                    }
                    return null;
                }
            };
            
            vscode.window.showInputBox(inputOptions).then(value => {
                if (value) {
                    
                    let csvEditor: CSVeditor = new CSVeditor(this.env);
                    let pickItems: vscode.QuickPickItem[] = csvEditor.searchAllEditorTableItemInProject(value);
                    vscode.window.showQuickPick(pickItems, {
                        placeHolder: '选择你要添加的物编数据的UID和名称'
                    }).then((selectedItem) => {
                        if (selectedItem) {
                            vscode.window.showInformationMessage(`你选择了: ${selectedItem.label}`);
                            
                            csvEditor.addEditorTableItemFromProject(selectedItem);
                        }
                    });
                }
            });
            
        });
        this.context.subscriptions.push(addUIDandNameToCSVfromProjectCommand);

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
            if (!this.env.csvTableUri) {
                vscode.window.showErrorMessage("未找到合适的位置生成CSV");
                return false;
            }
            // 生成csv模板
            let templateGenerator = new TemplateGenerator(this.env);
            
            let targetUri: vscode.Uri = this.env.csvTableUri;
            await templateGenerator.generateAllTemplateCSVtoTargetPath(targetUri);
        });
    }

    private registerCommandOfDownloadPresetUI() {
        vscode.commands.registerCommand('y3-helper.downloadPresetUI', async () => {
            await this.env.waitReady();
            if (!this.env.mapUri) {
                vscode.window.showErrorMessage("未找到地图路径！");
                return false;
            };
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在下载预设UI...',
            }, async (progress, token) => {
                await new preset.UI(this.env).download("https://up5.nosdn.127.net/editor/zip/edc461b312fc308779be9273a2cee6bb");
            });
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
            this.registerEditorTableView();
            console.log("y3-helper.clickY3-Helper-container");
        });
    }

    private registerEditorTableView() {
        const editorTableDataProvider=new EditorTableDataProvider(this.env);
        vscode.window.registerTreeDataProvider(
            'y3-helper.editorTableView',
            editorTableDataProvider
        );
        vscode.commands.registerCommand('y3-helper.refreshTableViewer', () => {
            editorTableDataProvider.refresh();
        });
        

        vscode.commands.registerCommand('y3-helper.editorTableView.refresh', () => editorTableDataProvider.refresh());

        const goEditorTableSymbolProvider = new GoEditorTableSymbolProvider(
            this.env.editorTablePath,
            this.env.zhlanguageJson,
            englishPathToChinese
        );
        
        this.context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(goEditorTableSymbolProvider));

        const goEditorTableDocumentSymbolProvider = new GoEditorTableDocumentSymbolProvider(this.env.zhlanguageJson);
        let sel: vscode.DocumentSelector = { scheme: 'file', language: 'json' };
        this.context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(sel,goEditorTableDocumentSymbolProvider));

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
        this.registerCommandOfDownloadPresetUI();

        this.registerEditorTableView();
        this.registerCommandOfOpenFile();
        
        this.checkNewProject();
        this.reloadEnvWhenConfigChange();

        this.registerCommonCommands();

        this.registerCommandOfCSVeditor();
    }
}

export function activate(context: vscode.ExtensionContext) {
    let helper = new Helper(context);

    helper.start();
}

export function deactivate() {}
