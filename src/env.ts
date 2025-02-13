import * as vscode from 'vscode';
import * as os from 'os';
import winreg from 'winreg';
import path from 'path';
import * as tools from './tools';
import { Language } from "./editorTable/language";
import { queue, throttle } from './utility/decorators';
import * as y3 from 'y3-helper';
import * as jsonc from 'jsonc-parser';
import { EditorManager } from './editorTable/editorTable';
import * as l10n from '@vscode/l10n';


type EditorVersion = '1.0' | '2.0' | 'unknown';

export class Map {
    id: bigint = 0n;
    private _editorTable: EditorManager;
    description: string;
    scriptUri: vscode.Uri;
    language;
    constructor(public name: string, public uri: vscode.Uri) {
        this._editorTable = new EditorManager(vscode.Uri.joinPath(this.uri, 'editor_table'));
        this.scriptUri = vscode.Uri.joinPath(this.uri, 'script');
        this.description = name;
        this.language = new Language(this);
        this.language.onDidChange(() => {
            this._editorTable.flushName();
        });
    }

    get editorTable() {
        if (env.project?.setting?.use_main_level_trigger_and_object) {
            return env.project?.entryMap?._editorTable ?? this._editorTable;
        } else {
            return this._editorTable;
        }
    }

    async start() {
        await Promise.all([
            this.language.start(),
            (async () => {
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
            })(),
            (async () => {
                let descFile = await y3.fs.readFile(y3.uri(this.uri, 'desc.json'));
                if (!descFile) {
                    return;
                }
                let descJson = jsonc.parse(descFile.string);
                if (!descJson) {
                    return;
                }
                this.description = descJson.name;
            })(),
            vscode.workspace.fs.createDirectory(y3.uri(this.scriptUri, '.log')),
        ]);
    }
}

interface ProjectSetting {
    use_main_level_trigger_and_object: boolean;
    use_main_level_ui: boolean;
}

class Project extends vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    constructor(public uri: vscode.Uri, private onDiDChange?: () => void) {
        super(() => {
            this.disposables.forEach(d => d.dispose());
        });
    }

    entryMapId: bigint = 0n;
    maps: Map[] = [];
    entryMap?: Map;
    setting?: ProjectSetting;
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

        started.push(this.loadSetting());

        for (const [mapName] of await y3.fs.dir(this.uri, 'maps')) {
            let map = new Map(mapName, vscode.Uri.joinPath(this.uri, 'maps', mapName));
            this.maps.push(map);
            started.push(map.start());
        }

        await Promise.all(started);

        this.entryMap = this.maps.find(map => map.id === this.entryMapId);
    }

    private async loadSetting() {
        let applySetting = async () => {
            try {
                let settingFile = await y3.fs.readFile(vscode.Uri.joinPath(this.uri, 'setting.json'));
                if (!settingFile) {
                    return;
                }
                this.setting = jsonc.parse(settingFile.string);
            } catch (error) {
                y3.log.error(l10n.t('读取项目设置失败: {0}', String(error)));
                vscode.window.showErrorMessage(l10n.t('读取项目设置失败: {0}', String(error)));
            }
        };

        await applySetting();
        let fw = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.uri, 'setting.json'));
        this.disposables.push(fw);
        fw.onDidChange(async () => {
            await applySetting();
            this.onDiDChange?.();
        });
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
                openLabel: l10n.t('选择Y3编辑器路径'),
                filters: {
                    [l10n.t('编辑器')]: ['exe']
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
                openLabel: l10n.t('选择Y3地图路径'),
                filters: {
                    [l10n.t('地图')]: ['map', 'project']
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
    // Editor.exe 的路径
    public editorUri?: vscode.Uri;
    // Game_x64h.exe 的路径
    public editorExeUri?: vscode.Uri;
    public mapUri?: vscode.Uri;
    public scriptUri?: vscode.Uri;
    public globalScriptUri?: vscode.Uri;
    public y3Uri?: vscode.Uri;
    public helperUri?: vscode.Uri;
    public metaUri?: vscode.Uri;
    public pluginUri?: vscode.Uri;
    public projectUri?: vscode.Uri;
    public excelUri?: vscode.Uri;// excel表格路径
    public ruleUri?: vscode.Uri;// rule路径
    public project?: Project;
    public currentMap?: Map;

    public get triggerMapUri(): vscode.Uri | undefined {
        if (this.project?.setting?.use_main_level_trigger_and_object) {
            return this.project?.entryMap?.uri;
        } else {
            return this.mapUri;
        }
    }

    /**
     * 当前触发器与物编使用的地图（项目管理 -> 使用主地图触发器与物编）
     */
    public get currentTriggerMap(): Map | undefined {
        if (this.project?.setting?.use_main_level_trigger_and_object) {
            return this.project?.entryMap;
        } else {
            return this.currentMap;
        }
    }

    public get editorTableUri(): vscode.Uri | undefined {
        if (!this.triggerMapUri) {
            return undefined;
        }
        return y3.uri(this.triggerMapUri, 'editor_table');
    }

    @throttle(100)
    private fireOnDidReload() {
        this.envChangeEmitter.fire();
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
        this.y3Uri = vscode.Uri.joinPath(this.scriptUri, l10n.t('y3'));
        this.helperUri = vscode.Uri.joinPath(this.scriptUri, `/${l10n.t("y3-helper")}`);
        this.metaUri = vscode.Uri.joinPath(this.helperUri, 'meta');
        this.pluginUri = vscode.Uri.joinPath(this.helperUri, 'plugin');
        this.excelUri = vscode.Uri.joinPath(this.helperUri, 'excel');
        this.ruleUri = vscode.Uri.joinPath(this.helperUri, 'excel_rule');
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
        this.project?.dispose();
        this.project = new Project(projectUri, () => {
            this.fireOnDidReload();
        });
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
