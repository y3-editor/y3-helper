import * as vscode from 'vscode';
import * as os from 'os';
import winreg from 'winreg';
import path from 'path';

type EditorVersion = '1.0' | '2.0' | 'unknown';

export class Env {
    private logger: vscode.OutputChannel;

    constructor(logger: vscode.OutputChannel) {
        this.logger = logger;
    }

    private async searchEditorUri(): Promise<vscode.Uri | undefined> {
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
        return vscode.Uri.file(path);
    }

    private async getEditorVersion(): Promise<EditorVersion> {
        if (!this.editorUri) {
            return 'unknown';
        }
        let folder = path.join(this.editorUri.fsPath, '../..');
        let folderName = path.basename(folder);
        if (folderName === '1.0') {
            return '1.0';
        };
        return '2.0';
    }

    private async searchMapPathInProject(folder: vscode.Uri, depth: number): Promise<vscode.Uri | undefined> {
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
                let mapFolder = await this.searchMapPathInProject(vscode.Uri.joinPath(folder, file[0]), depth - 1);
                if (mapFolder) {
                    return mapFolder;
                }
            }
        }

        return undefined;
    }

    private async searchMapFolderBySelectedUri(uri: vscode.Uri): Promise<vscode.Uri | undefined> {
        // 检查一下上一层目录
        let parentUri = vscode.Uri.joinPath(uri, '..');
        let mapFolder = await this.searchMapPathInProject(parentUri, 0)
                    ||  await this.searchMapPathInProject(uri, 3);
        return mapFolder;
    }

    private async searchProjectPath(): Promise<vscode.Uri | undefined> {
        // 先直接搜索打开的工作目录
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                let mapFolder = await this.searchMapFolderBySelectedUri(folder.uri);
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
        let mapFolder = await this.searchMapFolderBySelectedUri(selectedFolder);
        if (mapFolder) {
            return mapFolder;
        }

        return undefined;
    }

    public status: 'not ready' | 'initing' | 'ready' = 'not ready';
    public editorVersion?: EditorVersion;
    public editorUri?: vscode.Uri;
    public scriptUri?: vscode.Uri;
    public y3Uri?: vscode.Uri;

    private async init() {
        await Promise.allSettled([
            async () => {
                this.editorUri = await this.searchEditorUri();
                this.editorVersion = await this.getEditorVersion();
            },
            async () => {
                this.scriptUri = await this.searchProjectPath();
                if (this.scriptUri) {
                    this.y3Uri = vscode.Uri.joinPath(this.scriptUri, 'y3');
                }
            }
        ]);

        this.logger.appendLine(`editorUri: ${this.editorUri?.fsPath}`);
        this.logger.appendLine(`editorVersion: ${this.editorVersion}`);
        this.logger.appendLine(`scriptUri: ${this.scriptUri?.fsPath}`);
        this.logger.appendLine(`y3Uri: ${this.y3Uri?.fsPath}`);
    }

    public async waitReady() {
        if (this.status === 'ready') {
            return;
        }
        if (this.status === 'initing') {
            // 自旋
            while (this.status === 'initing') {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }
        this.status = 'initing';
        await this.init();
        this.status = 'ready';
    }
}
