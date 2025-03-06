import { RelativePattern } from "vscode";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as tools from '../tools';
import { BaseDefine } from "./baseDefine";

const dirPath = 'ui';
const prefabPath = 'ui/prefab';

type Node = {
    name: string,
    uid: string,
    type: number,
    childs: Node[],
};

type UIPackage = {
    画板: Node[],
    场景UI: Node[],
    元件: Node[],
};

export class UI extends BaseDefine {
    private cache;
    constructor(map: y3.Map) {
        super(map);

        this.cache = new tools.Cache(this.loadUIPackage.bind(this), {
            画板: [],
            场景UI: [],
            元件: [],
        });

        this.onDidChange(() => {
            this.cache.updateVersion();
        });
    }

    get watchPattern() {
        return new RelativePattern(this.map.uri, dirPath + '/*.json');
    }

    private makeNode(object: any): Node | undefined {
        if (typeof object !== 'object') {
            return;
        }
        return {
            name: object['name'],
            uid: object['uid'] ?? object['prefab_key'] ?? object['prefab_sub_key'],
            type: object['type'],
            childs: (object['children'] as Array<Object>)
                ?.map(this.makeNode, this)
                .filter((node): node is Node => node !== undefined),
        };
    }

    private async loadUI(fileUri: vscode.Uri): Promise<Node|undefined> {
        let jsonText = (await tools.fs.readFile(fileUri))?.string;
        if (!jsonText) {
            return;
        }
        let json = JSON.parse(jsonText);
        if (typeof json !== 'object') {
            return;
        }
        if (json['name'] === undefined) {
            return;
        }

        return this.makeNode(json);
    }

    private async loadSceneUI(fileUri: vscode.Uri) {
        let jsonText = (await tools.fs.readFile(fileUri))?.string;
        if (!jsonText) {
            return undefined;
        }
        let json = JSON.parse(jsonText);
        if (typeof json !== 'object') {
            return undefined;
        }
        
        if (!Array.isArray(json['children'])) {
            return undefined;
        }

        let nodes: Node[] = [];
        for (const child of json['children']) {
            let node = this.makeNode(child);
            if (node) {
                nodes.push(node);
            }
        }
        return nodes;
    }

    private async loadPrefeb(fileUri: vscode.Uri) {
        let jsonText = (await tools.fs.readFile(fileUri))?.string;
        if (!jsonText) {
            return undefined;
        }
        let json = JSON.parse(jsonText);
        if (typeof json !== 'object') {
            return undefined;
        }

        let node = this.makeNode(json['data']);
        if (node) {
            node.name = json['name'];
        }
        return node;
    }

    private async loadUIPackage() {
        let uiPackage: UIPackage = {
            画板: [],
            场景UI: [],
            元件: [],
        };
        let dir = vscode.Uri.joinPath(this.map.uri, dirPath);
        let files = await vscode.workspace.fs.readDirectory(dir);
        for (let [fileName, fileType] of files) {
            if (fileType !== vscode.FileType.File) {
                continue;
            };
            if (!fileName.endsWith('.json')) {
                continue;
            };
            let uri = vscode.Uri.joinPath(dir, fileName);
            switch (fileName) {
                case 'SceneUI.json': {
                    let nodes = await this.loadSceneUI(uri);
                    if (nodes) {
                        uiPackage.场景UI = nodes;
                    }
                    continue;
                }
                default: {
                    let node = await this.loadUI(uri);
                    if (node) {
                        uiPackage.画板.push(node);
                    }
                }
            }
        }
        let prefabDir = vscode.Uri.joinPath(this.map.uri, prefabPath);
        let prefabFiles = await vscode.workspace.fs.readDirectory(prefabDir);
        for (let [fileName, fileType] of prefabFiles) {
            if (fileType !== vscode.FileType.File) {
                continue;
            };
            if (!fileName.endsWith('.json')) {
                continue;
            };
            let uri = vscode.Uri.joinPath(prefabDir, fileName);
            let node = await this.loadPrefeb(uri);
            if (node) {
                uiPackage.元件.push(node);
            }
        }
        return uiPackage;
    }

    public async getUIPackage() {
        return await this.cache.get();
    }
}
