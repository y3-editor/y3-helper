import path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import winreg from 'winreg';
import { runShell } from './runShell';
import { LuaDocMaker } from './makeLuaDoc';

let OutputChannel: vscode.OutputChannel;
let Context: vscode.ExtensionContext;

async function searchY3Editor(): Promise<vscode.Uri | undefined> {
    let platform = os.platform();
    if (platform !== 'win32') {
        return undefined;
    };
    let regKey = new winreg({
        hive: winreg.HKLM,
        key: "\\SOFTWARE\\Classes\\y3editor",
    });
    let path = await new Promise<string|undefined>((resolve, reject) => {
        regKey.get(winreg.DEFAULT_VALUE, (err, item) => {
            if (err) {
                resolve(undefined);
            }
            resolve(item.value);
        });
    });
    if (!path) {
        return undefined;
    }
    OutputChannel.appendLine(`编辑器路径：${path}`);
    return vscode.Uri.file(path);
}

type Y3Version = '1.0' | '2.0' | 'unknown';

async function getY3Version(): Promise<Y3Version> {
    let editorUri = await searchY3Editor();
    if (!editorUri) {
        return 'unknown';
    };
    let folder = path.join(editorUri.fsPath, '../..');
    let folderName = path.basename(folder);
    if (folderName === '1.0') {
        return '1.0';
    };
    return '2.0';
}

function registerCommandOfInitProject() {
    async function searchMapPathInProject(folder: vscode.Uri, depth: number): Promise<vscode.Uri | undefined> {
        // 递归搜索目录下的 `header.map` 文件所在目录
        try {
            let state = await vscode.workspace.fs.stat(vscode.Uri.joinPath(folder, 'header.map'));
            if (state.type === vscode.FileType.File) {
                return folder;
            }
        } catch (error) {
            // ignore
        }
        if (depth <= 0) {
            return undefined;
        }

        let files = await vscode.workspace.fs.readDirectory(folder);
        for (const file of files) {
            if (file[1] === vscode.FileType.Directory) {
                let mapFolder = await searchMapPathInProject(vscode.Uri.joinPath(folder, file[0]), depth - 1);
                if (mapFolder) {
                    return mapFolder;
                }
            }
        }

        return undefined;
    }
    
    async function searchProjectPath(): Promise<vscode.Uri | undefined> {
        // 先直接搜索打开的工作目录
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                // 检查一下上一层目录
                let parentFolder = vscode.Uri.joinPath(folder.uri, '..');
                let mapFolder = await searchMapPathInProject(parentFolder, 0)
                             || await searchMapPathInProject(folder.uri, 3);
                if (mapFolder) {
                    return mapFolder;
                }
            }
        }

        // 如果没有，则询问用户
        let selectedFolders = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false, // 竟然不能同时选择文件和文件夹
            canSelectMany: false,
            openLabel: '选择地图路径',
            filters: {
                '地图': ['map', 'project']
            }
        });

        let selectedFolder = selectedFolders?.[0];
        if (!selectedFolder) {
            return undefined;
        }

        if ((await vscode.workspace.fs.stat(selectedFolder)).type === vscode.FileType.File) {
            selectedFolder = vscode.Uri.joinPath(selectedFolder, '..');
        };
        let parentFolder = vscode.Uri.joinPath(selectedFolder, '..');
        let mapFolder = await searchMapPathInProject(parentFolder, 0)
                     || await searchMapPathInProject(selectedFolder, 3);
        if (mapFolder) {
            return mapFolder;
        }

        return undefined;
    }

    let disposable = vscode.commands.registerCommand('y3-helper.initProject', async () => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在初始化Y3项目...',
        }, async (progress, token) => {
            let mapFolder = await searchProjectPath();
            if (!mapFolder) {
                vscode.window.showErrorMessage('未找到地图路径，请先用编辑器创建地图！');
                return;
            };
            OutputChannel.append(`地图路径：${mapFolder.fsPath}`);
    
            // 先检查一下是不是已经有 `script/y3` 目录了
            let scriptFolder = vscode.Uri.joinPath(mapFolder, 'script');
            let y3Uri = vscode.Uri.joinPath(scriptFolder, 'y3');
            try {
                let state = await vscode.workspace.fs.stat(y3Uri);
                if (state.type === vscode.FileType.Directory) {
                    // 直接删除这个目录
                    try {
                        await vscode.workspace.fs.delete(y3Uri, {
                            recursive: true,
                            useTrash: true,
                        });
                        OutputChannel.appendLine(`已将原有的 ${y3Uri.fsPath} 目录移至回收站`);
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
            let y3Version = await getY3Version();
            if (y3Version === '1.0') {
                await runShell("初始化Y3项目", "git", [
                    "checkout",
                    "-b",
                    "1.0",
                    "origin/1.0"
                ], y3Uri);
            }

            // 初始化配置
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(scriptFolder, 'log'));
            let copySource = vscode.Uri.joinPath(y3Uri, '演示/项目配置');
            for await (const entry of await vscode.workspace.fs.readDirectory(copySource)) {
                await vscode.workspace.fs.copy(
                    vscode.Uri.joinPath(copySource, entry[0]),
                    vscode.Uri.joinPath(scriptFolder, entry[0]),
                );
            }

            // 打开项目
            Context.globalState.update("NewProjectPath", scriptFolder.fsPath);
            await vscode.commands.executeCommand('vscode.openFolder', scriptFolder);
        });
    });

    Context.subscriptions.push(disposable);
}

async function launchGame() {
    let scriptFolder = vscode.workspace.workspaceFolders?.[0];
    if (!scriptFolder) {
        vscode.window.showErrorMessage("没有打开工作目录！");
        return;
    }
    let editorUri = await searchY3Editor();
    if (!editorUri) {
        vscode.window.showErrorMessage("未找到编辑器！");
        return;
    }
    let mapPath = path.join(scriptFolder.uri.fsPath, '..');
    await runShell(
        "启动游戏",
        editorUri.fsPath,
        [
            "-dx11",
            "-console",
            "-start=Python",
            "-python-args=type@editor_game,subtype@editor_game,release@true,editor_map_path@" + mapPath,
            "-plugin-config=Plugins-PyQt",
            "-python-debug=1",
        ],
    );
}

function registerTask() {
    let disposable = vscode.tasks.registerTaskProvider("y3-helper", {
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
                            await launchGame();
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
    Context.subscriptions.push(disposable);
}

function checkNewProject() {
    let newProjectPath = Context.globalState.get("NewProjectPath");
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
    if (Context.globalState.get("NewProjectPath") === workspaceUri.fsPath) {
        Context.globalState.update("NewProjectPath", undefined);
        new Promise(async () => {
            await vscode.commands.executeCommand(
                'vscode.open',
                vscode.Uri.joinPath(workspaceUri, 'main.lua'),
            );
            vscode.window.showInformationMessage("欢迎使用Y3编辑器！");
        });
    };
}

function registerCommandOfMakeLuaDoc() {
    vscode.commands.registerCommand('y3-helper.makeLuaDoc', async () => {
        await vscode.window.withProgress({
            title: '正在生成文档...',
            location: vscode.ProgressLocation.Window,
        }, async (progress) => {
            let luaDocMaker = new LuaDocMaker(Context);
            await luaDocMaker.make();
        });
    });
}

export function activate(context: vscode.ExtensionContext) {
    Context = context;

    OutputChannel = vscode.window.createOutputChannel("Y3 - Helper", { log: true });
    OutputChannel.clear();
    context.subscriptions.push(OutputChannel);

    registerCommandOfInitProject();
    registerCommandOfMakeLuaDoc();
    registerTask();
    checkNewProject();
}

export function deactivate() {}
