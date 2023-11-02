import path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import winreg from 'winreg';

let OutputChannel: vscode.OutputChannel;
let Context: vscode.ExtensionContext;

async function runShell(command: string, args: string[], cwd?: vscode.Uri) {
    let task = await vscode.tasks.executeTask(new vscode.Task(
        { type: 'shell' },
        vscode.TaskScope.Global,
        '初始化Y3项目',
        'y3-helper',
        new vscode.ShellExecution(command, args, cwd ? {
            cwd: cwd.fsPath,
        } : undefined),
    ));
    await new Promise<void>((resolve) => {
        let disposable = vscode.tasks.onDidEndTask((taskEndEvent) => {
            if (task === taskEndEvent.execution) {
                disposable.dispose();
                resolve();
            };
        });
    });
}

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
    let folder = path.normalize(path.join(editorUri.fsPath, '../..'));
    let folderName = path.basename(folder);
    if (folderName === '1.0') {
        return '1.0';
    };
    return '2.0';
}

function registerCommandOfInitProject(context: vscode.ExtensionContext) {
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
    
            // 先检查一下是不是已经有 `script` 目录了
            let scriptFolder = vscode.Uri.joinPath(mapFolder, 'script');
            try {
                let state = await vscode.workspace.fs.stat(scriptFolder);
                if (state.type === vscode.FileType.Directory) {
                    // 直接删除这个目录
                    try {
                        await vscode.workspace.fs.delete(scriptFolder, {
                            recursive: true,
                            useTrash: true,
                        });
                        OutputChannel.appendLine(`已将原有的 ${scriptFolder.fsPath} 目录移至回收站`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`${scriptFolder.fsPath} 已被占用，请手动删除它！`);
                        return;
                    }
                } else {
                    vscode.window.showErrorMessage(`${scriptFolder.fsPath} 已被占用，请手动删除它！`);
                    return;
                };
            } catch (error) {
                // ignore
            }
    
            // 创建初始文件
            await vscode.workspace.fs.createDirectory(scriptFolder);
            await vscode.workspace.fs.writeFile(
                vscode.Uri.joinPath(scriptFolder,'main.lua'),
                new TextEncoder().encode('-- 游戏启动后会自动运行此文件'),
            );
    
            // 从github上 clone 项目，地址为 “https://github.com/y3-editor/y3-lualib”
            let y3Uri = vscode.Uri.joinPath(scriptFolder, 'y3');
            await runShell("git", [
                "clone",
                "https://github.com/y3-editor/y3-lualib.git",
                y3Uri.fsPath,
            ]);
    
            // 检查编辑器版本，如果是 1.0 版本则切换到 1.0 分支
            let y3Version = await getY3Version();
            if (y3Version === '1.0') {
                await runShell("git", [
                    "checkout",
                    "-b",
                    "1.0",
                    "origin/1.0"
                ], y3Uri);
            }

            // 初始化配置
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(scriptFolder, 'log'));
            await vscode.workspace.fs.copy(vscode.Uri.joinPath(y3Uri, '演示/项目配置'), vscode.Uri.joinPath(scriptFolder, '.vscode'));
        });
    });

    context.subscriptions.push(disposable);
}

export function activate(context: vscode.ExtensionContext) {
    Context = context;

    OutputChannel = vscode.window.createOutputChannel("Y3 - Helper", { log: true });
    OutputChannel.clear();
    context.subscriptions.push(OutputChannel);

    registerCommandOfInitProject(context);
}

export function deactivate() {}
