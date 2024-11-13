import * as vscode from 'vscode';
import * as os from 'os';
import winreg from 'winreg';
import path from 'path';
import * as tools from './tools';
import { isPathValid } from './utility';
import { queue } from './utility/decorators';
import * as y3 from 'y3-helper';
import * as jsonc from 'jsonc-parser';
import { EditorManager } from './editorTable/editorTable';

type EditorVersion = '1.0' | '2.0' | 'unknown';

class Map {
    id: bigint = 0n;
    editorTable: EditorManager;
    scriptUri: vscode.Uri;
    constructor(public name: string, public uri: vscode.Uri) {
        this.editorTable = new EditorManager(vscode.Uri.joinPath(this.uri, 'editor_table'));
        this.scriptUri = vscode.Uri.joinPath(this.uri, 'script');
    }

    async start() {
        let headerMap = await y3.fs.readFile(vscode.Uri.joinPath(this.uri, 'header.map'));
        if (!headerMap) {
            return;
        }
        let headerMapJson = jsonc.parseTree(headerMap.string);
        if (!headerMapJson) {
            return;
        }
        let idNode = jsonc.findNodeAtLocation(headerMapJson, ['id']);
        if (!idNode) {
            return;
        }
        this.id = BigInt(headerMap.string.slice(idNode.offset, idNode.offset + idNode.length));
    }
}

class Project {
    constructor(public uri: vscode.Uri) {}

    entryMapId: bigint = 0n;
    maps: Map[] = [];
    entryMap?: Map;
    async start() {
        let projectFile = await y3.fs.readFile(vscode.Uri.joinPath(this.uri, 'header.project'));
        if (!projectFile) {
            return;
        }
        let headerProject = jsonc.parseTree(projectFile.string);
        if (!headerProject) {
            return;
        }
        let entryMapIdNode = jsonc.findNodeAtLocation(headerProject, ['entry_map', 'id']);
        if (!entryMapIdNode) {
            return;
        }

        this.entryMapId = BigInt(projectFile.string.slice(entryMapIdNode.offset, entryMapIdNode.offset + entryMapIdNode.length));

        let started: Promise<any>[] = [];
        for (const [mapName] of await y3.fs.dir(this.uri, 'maps')) {
            let map = new Map(mapName, vscode.Uri.joinPath(this.uri, 'maps', mapName));
            this.maps.push(map);
            started.push(map.start());
        }

        await Promise.all(started);

        this.entryMap = this.maps.find(map => map.id === this.entryMapId);
    }

    findMapByUri(uri: vscode.Uri) {
        return this.maps.find(map => uri.toString().startsWith(map.uri.toString()));
    }
}

class Env {
    private envChangeEmitter = new vscode.EventEmitter<void>();
    public onDidChange = this.envChangeEmitter.event;

    private async searchEditorUriByReg(): Promise<vscode.Uri | undefined> {
        let platform = os.platform();
        if (platform !== 'win32') {
            return undefined;
        };
        let regKey = new winreg({
            hive: winreg.HKLM,
            key: "\\SOFTWARE\\Classes\\y3editor",
        });
        let editorPath = await new Promise<string|undefined>((resolve, reject) => {
            regKey.get(winreg.DEFAULT_VALUE, (err, item) => {
                if (err || !item) {
                    resolve(undefined);
                }
                resolve(item.value);
            });
        });
        if (typeof editorPath !== 'string') {
            return undefined;
        }
        return vscode.Uri.file(editorPath);
    }

    private async isValidEditorPath(editorPath: string): Promise<boolean> {
        if (path.basename(editorPath) !== 'Editor.exe') {
            return false;
        }
        try {
            let state = await vscode.workspace.fs.stat(vscode.Uri.file(editorPath));
            if (state.type === vscode.FileType.File) {
                return true;
            }
        } catch (error) {
        }
        return false;
    }

    private async searchEditorUri(askUser = false): Promise<vscode.Uri | undefined> {
        // 先看看设置里有没有
        let editorPath: string|undefined = vscode.workspace.getConfiguration('Y3-Helper', vscode.workspace.workspaceFolders?.[0]).get('EditorPath');
        if (editorPath && await this.isValidEditorPath(editorPath)) {
            return vscode.Uri.file(editorPath);
        }

        // 再看看注册表里有没有
        try {
            let editorUri = await this.searchEditorUriByReg();
            if (editorUri) {
                return editorUri;
            }
        } catch (error) {
            tools.log.error(String(error));
        }

        // 如果没有，则询问用户
        while (askUser) {
            let selectedFiles = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                openLabel: '选择Y3编辑器路径',
                filters: {
                    '编辑器': ['exe']
                }
            });
            let selectedExe = selectedFiles?.[0];
            if (!selectedExe) {
                return undefined;
            }
            if (await this.isValidEditorPath(selectedExe.fsPath)) {
                await vscode.workspace.getConfiguration('Y3-Helper', vscode.workspace.workspaceFolders?.[0]).update('EditorPath', selectedExe.fsPath);
                return selectedExe;
            }
        }
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

    private async searchProjectByFolder(folder: vscode.Uri): Promise<vscode.Uri | undefined> {
        let currentUri = folder;
        for (let i = 0; i < 20; i++) {
            if (await y3.fs.isExists(vscode.Uri.joinPath(currentUri, 'header.project'))) {
                return currentUri;
            }
            let parentUri = vscode.Uri.joinPath(currentUri, '..');
            if (parentUri.fsPath === currentUri.fsPath) {
                break;
            }
            currentUri = parentUri;
        }
        return undefined;
    }

    private async searchProject(search: boolean, askUser: boolean): Promise<[vscode.Uri, vscode.Uri] | undefined> {
        // 先直接搜索打开的工作目录
        if (search) {
            if (vscode.workspace.workspaceFolders) {
                for (const folder of vscode.workspace.workspaceFolders) {
                    let result = await this.searchProjectByFolder(folder.uri);
                    if (result) {
                        return [result, folder.uri];
                    }
                }
            }
        }

        if (askUser) {
            // 如果没有，则询问用户
            let selectedFolders = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false, // 竟然不能同时选择文件和文件夹
                canSelectMany: false,
                openLabel: '选择Y3地图路径',
                filters: {
                    '地图': ['map', 'project']
                }
            });
    
            let selectedFile = selectedFolders?.[0];
            if (!selectedFile) {
                return undefined;
            }

            let selectedFolder = vscode.Uri.joinPath(selectedFile, '..');
            let projectUri = await this.searchProjectByFolder(selectedFolder);
            return projectUri ? [projectUri, selectedFolder] : undefined;
        }
    }

    private getEditorExeUri(): vscode.Uri | undefined {
        if (!this.editorUri) {
            return undefined;
        }
        let editorExeUri = vscode.Uri.joinPath(this.editorUri, '../Engine/Binaries/Win64/Game_x64h.exe');
        return editorExeUri;
    }

    public editorVersion: EditorVersion = 'unknown';
    public editorUri?: vscode.Uri;
    public editorExeUri?: vscode.Uri;
    public mapUri?: vscode.Uri;
    public scriptUri?: vscode.Uri;
    public globalScriptUri?: vscode.Uri;
    public y3Uri?: vscode.Uri;
    public pluginUri?: vscode.Uri;
    public projectUri?: vscode.Uri;
    public editorTableUri?: vscode.Uri;// 物编数据
    public excelUri?: vscode.Uri;// excel表格路径
    public ruleUri?: vscode.Uri;// rule路径
    public project?: Project;
    public currentMap?: Map;

    private _editorTablePath: string = "";
    
    public get editorTablePath(): string{
        if (!vscode.workspace.workspaceFolders || !vscode.workspace.workspaceFolders[0]) {
            return "";
        }
        this._editorTablePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "../editor_table");


        if (!isPathValid(this._editorTablePath)) {
            this._editorTablePath = "";
        }
        return this._editorTablePath;
    }

    private _timer?: NodeJS.Timeout;
    private fireOnDidReload() {
        if (this._timer) {
            return;
        }
        this._timer = setTimeout(() => {
            this._timer = undefined;
            this.envChangeEmitter.fire();
        }, 100);
    }

    @queue()
    public async updateEditor(askUser = false) {
        let editorUri = await this.searchEditorUri(askUser);
        if (!editorUri) {
            return;
        }
        this.editorUri = editorUri;
        this.editorVersion = await this.getEditorVersion();
        this.editorExeUri = this.getEditorExeUri();
        tools.log.info(`editorUri: ${this.editorUri?.fsPath}`);
        tools.log.info(`editorExeUri: ${this.editorExeUri?.fsPath}`);
        tools.log.info(`editorVersion: ${this.editorVersion}`);
        this.fireOnDidReload();
    }

    @queue()
    public async editorReady(askUser = false) {
        if (this.editorUri) {
            return;
        }
        await this.updateEditor(askUser);
    }

    public updateCurrentMap(map: Map) {
        if (this.currentMap === map) {
            return;
        }
        this.currentMap = map;
        this.mapUri = map.uri;
        this.scriptUri = vscode.Uri.joinPath(this.mapUri, 'script');
        this.y3Uri = vscode.Uri.joinPath(this.scriptUri, 'y3');
        this.pluginUri = vscode.Uri.joinPath(this.scriptUri, '/y3-helper/plugin');
        this.editorTableUri = vscode.Uri.joinPath(this.mapUri, "editor_table");
        this.excelUri = vscode.Uri.joinPath(this.scriptUri, "./y3-helper/excel/");
        this.ruleUri = vscode.Uri.joinPath(this.scriptUri, "./y3-helper/excel_rule/");
        tools.log.info(`mapUri: ${this.mapUri}`);
        tools.log.info(`projectUri: ${this.projectUri}`);
        tools.log.info(`scriptUri: ${this.scriptUri?.fsPath}`);
        tools.log.info(`y3Uri: ${this.y3Uri?.fsPath}`);
        tools.log.info(`editorTableUri: ${this.editorTableUri?.fsPath}`);
        this.fireOnDidReload();
    }

    @queue()
    public async updateMap(search: boolean, askUser: boolean) {
        let [projectUri, mapUri] = await this.searchProject(search, askUser) ?? [];
        if (!projectUri) {
            return;
        }
        this.projectUri = projectUri;
        this.globalScriptUri = vscode.Uri.joinPath(this.projectUri, 'global_script');
        this.project = new Project(projectUri);
        await this.project.start();
        if (!this.project.entryMap) {
            return;
        }
        let map = mapUri
            ? this.project.maps.find(map => mapUri!.toString().startsWith(map.uri.toString()))
            : undefined;
        if (map) {
            this.updateCurrentMap(map);
        } else {
            this.updateCurrentMap(this.project.entryMap);
        }
    }

    @queue()
    public async mapReady(askUser = false) {
        if (this.projectUri) {
            return;
        }
        await this.updateMap(true, askUser);
    }
}

export const env = new Env();
