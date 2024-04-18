import * as fs from 'fs';
import * as tools from "./tools";
import * as vscode from 'vscode';
import * as mainMenu from './mainMenu';

import { env } from './env';
import { runShell } from './runShell';
import { LuaDocMaker } from './makeLuaDoc';
import { GameLauncher } from './launchGame';
import { EXCELimporter } from './editorTable/EXCEL/EXCELimporter';
import { TemplateGenerator } from './editorTable/templateGenerator';
import { englishPathToChinese } from './constants';
import {
    CSVimporter, EditorTableDataProvider, GoEditorTableSymbolProvider,
    GoEditorTableDocumentSymbolProvider, FileNode,
    searchAllEditorTableItemInProject, searchAllEditorTableItemInCSV,
    updateEditorTableItemMap, CSVeditor
} from './editorTable';
import * as metaBuilder from './metaBuilder';




class Helper {
    private context: vscode.ExtensionContext;

    private editorTableDataProvider?: EditorTableDataProvider;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    private reloadEnvWhenConfigChange() {
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('Y3-Helper.EditorPath')) {
                env.reload();
                tools.log.info('配置已更新，已重新加载环境');
            }
        });
    }

    private registerCommonCommands() {
        vscode.commands.registerCommand('y3-helper.selectAnotherMap', async () => {
            env.reload();
            await env.updateMap(false, true);
            if (!vscode.workspace.workspaceFolders?.some((folder) => folder.uri.fsPath === env.scriptUri?.fsPath)) {
                vscode.commands.executeCommand('vscode.openFolder', env.scriptUri);
            }
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
                await env.mapReady(true);
                if (!env.scriptUri) {
                    vscode.window.showErrorMessage('未找到Y3地图路径，请先用编辑器创建地图或重新指定！');
                    return;
                };

                let scriptUri = env.scriptUri!;
                let y3Uri = env.y3Uri!;

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
                let editorVersion = env.editorVersion;
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

                mainMenu.init();
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
                let gameLauncher = new GameLauncher();
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
                let gameLauncher = new GameLauncher();
                let suc = gameLauncher.launch({
                    "lua_wait_debugger": true,
                });
                if (!suc) {
                    return;
                }

                await vscode.debug.startDebugging(vscode.workspace.workspaceFolders?.[0], "💡附加");
            });
        });
    }

    

    /**
     * 根据用户配置的路径 导入全部物编数据(CSV)
     */
    private registerCommandOfImportEditorTableDataFromCSV() {
        vscode.commands.registerCommand('y3-helper.importEditorTableDataFromCSV', async () => {
            await env.mapReady(true);
            let projectUri = env.projectUri;
            let editorExeUri = env.editorExeUri;
            let scriptUri= env.scriptUri;
            if (!projectUri) {
                vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
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
                let csvImporter = new CSVimporter();
                await csvImporter.importCSVFromOrderFolder();

            });
        });
    }

    /**
    * 根据用户配置的路径 和导入规则 导入全部物编数据(Excel)
    */
    private registerCommandOfImportEditorTableDataFromExcel() {
        vscode.commands.registerCommand('y3-helper.importEditorTableDataFromExcel', async () => {
            await env.mapReady(true);
            
            let projectUri = env.projectUri;
            let editorExeUri = env.editorExeUri;
            let scriptUri = env.scriptUri;
            if (!projectUri) {
                vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
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
                let excelImporter = new EXCELimporter();
                await excelImporter.excelImport();
                this.editorTableDataProvider?.refresh();
            });
        });
    }

    /**
     * 注册CSVeditor相关的命令
     */
    private registerCommandOfCSVeditor() {
        
        // 在CSV表格中添加物编项目的命令
        let addNewDataInCSVcommand = vscode.commands.registerCommand('y3-helper.addNewDataInCSV', async () => {
            await env.mapReady(true);
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
                
                if (!selection || !selection.description) {
                    vscode.window.showInformationMessage('未选择');
                    return;
                    
                }
                else {
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
                        let csvEditor: CSVeditor = new CSVeditor();
                        if (!selection.description) {
                            vscode.window.showInformationMessage('未选择');
                            return;
                        }
                        csvEditor.addNewUIDandNameInCSVwithoutConflict(selection.description, value);
                    }
                });
            });
        });
        this.context.subscriptions.push(addNewDataInCSVcommand);

        // 把Y3工程项目中已有的物编数据的UID和名称添加到CSV表格以便填写和导入的命令
        let addUIDandNameToCSVfromProjectCommand = vscode.commands.registerCommand("y3-helper.addUIDandNameToCSVfromProject", async () => {
            await env.mapReady(true);
            const inputOptions: vscode.InputBoxOptions = {
                prompt: '搜索项目中已有的物编数据项目UID或名称或类型名',
                placeHolder: 'UID或名称或类型名',
                validateInput: (text: string) => {
                    if (text.length === 0) {
                        return "输入的内容为空";
                    }
                    return null;
                }
            };

            vscode.window.showInputBox(inputOptions).then(value => {
                if (value) {

                    let csvEditor: CSVeditor = new CSVeditor();
                    let pickItems: vscode.QuickPickItem[] = searchAllEditorTableItemInProject(value);
                    vscode.window.showQuickPick(pickItems, {
                        placeHolder: '选择你要添加的物编数据项目'
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



        // 修改CSV表格中的物编项目的的名称的命令
        let modifyNameInCSVCommand = vscode.commands.registerCommand("y3-helper.modifyNameInCSV", async () => {
            await env.mapReady(true);
            const inputOptions: vscode.InputBoxOptions = {
                prompt: '搜索CSV表格中已有的物编数据项目',
                placeHolder: 'UID或名称或类型名',
                validateInput: (text: string) => {
                    if (text.length === 0) {
                        return "输入的内容为空";
                    }
                    return null;
                }
            };


            // 查询要改的项目
            vscode.window.showInputBox(inputOptions).then(async(value) => {
                if (value) {

                    // 列出查到的项目
                    let pickItems: vscode.QuickPickItem[] = await searchAllEditorTableItemInCSV(value);
                    vscode.window.showQuickPick(pickItems, {
                        placeHolder: '选择你要修改的物编数据项目'
                    }).then((selectedItem) => {
                        if (selectedItem) {
                            vscode.window.showInformationMessage(`你选择了: ${selectedItem.label}`);
                            const newNameInputOptions: vscode.InputBoxOptions = {
                                prompt: '新名称',
                                placeHolder: '请输入新名称',
                                validateInput: (text: string) => {
                                    if (text.length === 0) {
                                        return "输入的内容为空";
                                    }
                                    return null;
                                }
                            };
                            // 输入修改后的内容
                            vscode.window.showInputBox(newNameInputOptions).then(value => {
                                if (value && selectedItem.detail) {

                                    let csvEditor: CSVeditor = new CSVeditor();

                                    // detail里面装了uid
                                    csvEditor.modifyName(Number(selectedItem.detail), value);
                                    vscode.window.showInformationMessage(`${selectedItem.label} 被修改为: ${value}`);
                                }
                            });
                        }
                    });
                }
            });

        });
        this.context.subscriptions.push(modifyNameInCSVCommand);


        // 修改CSV表格中的物编项目的的uid的命令
        let modifyUIDInCSVCommand = vscode.commands.registerCommand("y3-helper.modifyUIDinCSV", async () => {
            await env.mapReady(true);
            const inputOptions: vscode.InputBoxOptions = {
                prompt: '搜索并选择CSV表格中已有的物编数据项目',
                placeHolder: 'UID或名称或类型名',
                validateInput: (text: string) => {
                    if (text.length === 0) {
                        return "输入的内容为空";
                    }
                    return null;
                }
            };


            // 查询要改的项目
            vscode.window.showInputBox(inputOptions).then(async (value) => {
                if (value) {

                    // 列出查到的项目
                    let pickItems: vscode.QuickPickItem[] = await searchAllEditorTableItemInCSV(value);
                    vscode.window.showQuickPick(pickItems, {
                        placeHolder: '选择你要修改的物编数据项目'
                    }).then((selectedItem) => {
                        if (selectedItem) {
                            vscode.window.showInformationMessage(`你选择了: ${selectedItem.label}`);
                            const newUIDinputOptions: vscode.InputBoxOptions = {
                                prompt: '新UID',
                                placeHolder: '请输入新UID',
                                validateInput: (text: string) => {
                                    if (text.length === 0) {
                                        return "输入的内容为空";
                                    }
                                    if (isNaN(Number(text))) {
                                        return "输入的内容不是数字UID";
                                    }
                                    if (!Number.isInteger(Number(text))) {
                                        return "输入的内容不是整数";
                                    }
                                    if (text.length !== 9){
                                        return "输入的内容必须为9位整数";
                                    }
                                    return null;
                                }
                            };
                            // 输入修改后的内容
                            vscode.window.showInputBox(newUIDinputOptions).then(value => {
                                if (value && selectedItem.detail) {

                                    let csvEditor: CSVeditor = new CSVeditor();

                                    // detail里面装了uid
                                    csvEditor.modifyUID(Number(selectedItem.detail),Number(value));
                                    vscode.window.showInformationMessage(`${selectedItem.label} 被修改为: ${value}`);
                                }
                            });
                        }
                    });
                }
            });

        });
        this.context.subscriptions.push(modifyUIDInCSVCommand);

    }

    private registerCommandOfGenerateTemplates() {

        let templateGenerator = new TemplateGenerator();



        // 生成CSV
        vscode.commands.registerCommand('y3-helper.generateAllTemplateCSV', async () => {
            await env.mapReady(true);
            let projectUri = env.projectUri;
            if (!projectUri) {
                vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
                return false;
            }
            if (!env.csvTableUri) {
                vscode.window.showErrorMessage("未找到合适的位置生成CSV");
                return false;
            }
            let targetUri: vscode.Uri = env.csvTableUri;
            await templateGenerator.generateAllTemplateCSVtoTargetPath(targetUri);
        });


        // 生成Excel
        vscode.commands.registerCommand('y3-helper.generateExcelTemplate', async () => {
            await env.mapReady(true);
            let projectUri = env.projectUri;
            if (!projectUri) {
                vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
                return false;
            }
            if (!env.excelTablePath) {
                vscode.window.showErrorMessage("未找到合适的位置生成物编数据Excel表模板");
                return false;
            }
            let targetUri: vscode.Uri= env.excelTablePath;
            if (targetUri) {
                // 把模板template/excel文件夹生成到模板文件夹的父级路径下
                await templateGenerator.generateExcelTemplate(targetUri);
            }
            else {
                vscode.window.showErrorMessage("找不到正确的路径生成物编数据Excel表模板，请检查插件配置Y3-Helper.editorTablceDataExcelFolder");
            }
        });
    }

    private registerCommandOfOpenFile() {
        vscode.commands.registerCommand('y3-helper.openFile', async (args:FileNode) => {
            const document = await vscode.workspace.openTextDocument(args.resourceUri.fsPath);
            vscode.window.showTextDocument(document);
        });
    }

    /**
     * EditorTableTreeView相关的命令注册
     */
    private registerEditorTableView() {
        const editorTableDataProvider = new EditorTableDataProvider();
        this.editorTableDataProvider = editorTableDataProvider;
        
        let treeView = vscode.window.createTreeView('y3-helper.editorTableView', {
            treeDataProvider: editorTableDataProvider,
            showCollapseAll: true,
        });
        
        vscode.commands.registerCommand('y3-helper.refreshTableViewer', () => {
            editorTableDataProvider.refresh();
        });

        vscode.commands.registerCommand('y3-helper.editorTableView.refresh', () => editorTableDataProvider.refresh());

        const goEditorTableSymbolProvider = new GoEditorTableSymbolProvider(
            env.editorTablePath,
            env.languageJson,
            englishPathToChinese
        );
        
        this.context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(goEditorTableSymbolProvider));

        const goEditorTableDocumentSymbolProvider = new GoEditorTableDocumentSymbolProvider(env.languageJson);
        let sel: vscode.DocumentSelector = { scheme: 'file', language: 'json' };
        this.context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(sel, goEditorTableDocumentSymbolProvider));
        

        // 右键菜单的命令注册
        vscode.commands.registerCommand("y3-helper.deleteEditorTableItem", (fileNode: FileNode) => {
            try {
                vscode.workspace.fs.delete(fileNode.resourceUri);
            }
            catch (error) {
                vscode.window.showErrorMessage("删除失败，错误为" + error);
            }
            //editorTableDataProvider.refresh();
        });
        vscode.commands.registerCommand("y3-helper.revealInFileExplorer", (fileNode: FileNode) => {
            // vscode自带的从系统文件浏览器中打开某一文件的命令
            vscode.commands.executeCommand('revealFileInOS', fileNode.resourceUri);
        });

        vscode.commands.registerCommand("y3-helper.copyTableItemUID", (fileNode: FileNode) => {
            if (fileNode.uid) {
                vscode.env.clipboard.writeText(String(fileNode.uid));
            }
            
        });
        vscode.commands.registerCommand("y3-helper.copyTableItemName", (fileNode: FileNode) => {
            if (fileNode.name) {
                vscode.env.clipboard.writeText(fileNode.name);
            }
        });

        vscode.commands.registerCommand("y3-helper.addNewEditorTableItem", async (fileNode: FileNode) => {
            await env.mapReady(true);
            const inputOptions: vscode.InputBoxOptions = {
                prompt: '名称',
                value: fileNode.name,
                placeHolder: '名称',
                validateInput: (text: string) => {
                    if (text.length === 0) {
                        return "输入的内容为空";
                    }
                    return null;
                }
            };
            vscode.window.showInputBox(inputOptions).then(
                value => {
                    if (value) {
                        if (editorTableDataProvider.createNewTableItemByFileNode(fileNode,value)) {
                            vscode.window.showInformationMessage("成功创建"+fileNode.label+":" + value);
                        }
                    }
                }
            );
            
            
        });

        vscode.commands.registerCommand("y3-helper.renameEditorTableItem", (fileNode: FileNode) => {
            const inputOptions: vscode.InputBoxOptions = {
                prompt: '修改后的新名称',
                value: fileNode.name,
                placeHolder: '新名称',
                validateInput: (text: string) => {
                    if (text.length === 0) {
                        return "输入的内容为空";
                    }
                    return null;
                }
            };
            vscode.window.showInputBox(inputOptions).then(
                value => {
                    if (value) {
                        editorTableDataProvider.renameEditorTableItemByFileNode(fileNode, value);
                    }
                }
            );
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

    /**
     * 初始化对物编数据文件的监视器
     */
    private initEditorTableWatcher()
    {
        
        // 创建物编数据文件系统监视器
        if (env.editorTablePath.length > 0) {
            let folderPath = env.editorTablePath;
            // 创建文件夹监视器
            const watcher = fs.watch(folderPath, { recursive: true }, (eventType, filename) => {
                updateEditorTableItemMap();
            });
            
        }
    }

    public start() {
        this.registerCommandOfInitProject();
        this.registerCommandOfMakeLuaDoc();
        this.registerCommandOfLaunchGame();
        this.registerCommandOfLaunchGameAndAttach();

        this.registerEditorTableView();
        this.registerCommandOfImportEditorTableDataFromCSV();
        this.registerCommandOfImportEditorTableDataFromExcel();

        this.registerCommandOfGenerateTemplates();

        
        this.registerCommandOfOpenFile();
        
        this.checkNewProject();
        this.reloadEnvWhenConfigChange();

        this.registerCommonCommands();

        this.registerCommandOfCSVeditor();

        mainMenu.init();
        metaBuilder.init();

        this.initEditorTableWatcher();

        env.reload();
    }
}

export function activate(context: vscode.ExtensionContext) {
    let helper = new Helper(context);

    helper.start();
}

export function deactivate() {}
