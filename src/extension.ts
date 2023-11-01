import * as vscode from 'vscode';

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

    async function runShell(command: string, args: string[]) {
        await vscode.tasks.executeTask(new vscode.Task(
            { type: 'shell' },
            vscode.TaskScope.Global,
            '初始化Y3项目',
            'y3-helper',
            new vscode.ShellExecution(command, args),
        ));
    }

    let disposable = vscode.commands.registerCommand('y3-helper.initProject', async () => {
        let mapFolder = await searchProjectPath();
        if (!mapFolder) {
            vscode.window.showErrorMessage('未找到地图路径，请先用编辑器创建地图！');
            return;
        };
        vscode.window.showInformationMessage(`地图路径：${mapFolder.fsPath}`);

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
                    vscode.window.showInformationMessage(`已将原有的 ${scriptFolder.fsPath} 目录移至回收站`);
                } catch (error) {
                    vscode.window.showErrorMessage(`${scriptFolder.fsPath} 已被占用，请手动删除它！`);
                    return;
                }
                return;
            } else {
                vscode.window.showErrorMessage(`${scriptFolder.fsPath} 已被占用，请手动删除它！`);
                return;
            };
        } catch (error) {
            // ignore
        }

        // 从github上 clone 项目，地址为 “https://github.com/y3-editor/y3-lualib”
        await runShell("git", [
            "clone",
            "https://github.com/y3-editor/y3-lualib.git",
            scriptFolder.fsPath
        ]);
        
    });

    context.subscriptions.push(disposable);
}

export function activate(context: vscode.ExtensionContext) {
    registerCommandOfInitProject(context);
}

export function deactivate() {}
