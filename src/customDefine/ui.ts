import { RelativePattern } from "vscode";
import * as vscode from 'vscode';
import { env } from "../env";
import * as tools from '../tools';
import { BaseDefine } from "./baseDefine";

const dirPath = 'ui';

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
    constructor() {
        super();

        this.onDidChange(() => {
            this._uiCache = undefined;
        });
    }

    private _uiCache?: UIPackage;

    get watchPattern() {
        if (!env.mapUri) {
            return;
        }
        return new RelativePattern(env.mapUri, dirPath + '/*.json');
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
        try {
            let json = JSON.parse(jsonText);
            if (typeof json !== 'object') {
                return;
            }
            if (json['name'] === undefined) {
                return;
            }

            return this.makeNode(json);
        } catch(e) {
            tools.log.error(e as Error);
        }
    }

    private async loadSceneUI(fileUri: vscode.Uri) {
        let jsonText = (await tools.fs.readFile(fileUri))?.string;
        if (!jsonText) {
            return undefined;
        }
        try {
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
        } catch(e) {
            tools.log.error(e as Error);
        }
    }

    private async loadPrefeb(fileUri: vscode.Uri) {
        let jsonText = (await tools.fs.readFile(fileUri))?.string;
        if (!jsonText) {
            return undefined;
        }
        try {
            let json = JSON.parse(jsonText);
            if (typeof json !== 'object') {
                return undefined;
            }

            let prefab_data = json['prefab_data'];
            if (!prefab_data || typeof prefab_data !== 'object') {
                return undefined;
            }

            let nodes: Node[] = [];
            for (const key in prefab_data) {
                let prefeb = prefab_data[key];
                let node = this.makeNode(prefeb['data']);
                if (node) {
                    node.name = prefeb['name'];
                    nodes.push(node);
                }
            }
            return nodes;
        } catch(e) {
            tools.log.error(e as Error);
        }
    }

    private async loadUIPackage() {
        let uiPackage: UIPackage = {
            画板: [],
            场景UI: [],
            元件: [],
        };
        try {
            if (!env.mapUri) {
                return uiPackage;
            }
            let dir = vscode.Uri.joinPath(env.mapUri, dirPath);
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
                    case 'ui_config.json': {
                        let nodes = await this.loadPrefeb(uri);
                        if (nodes) {
                            uiPackage.元件 = nodes;
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
        } finally {
            return uiPackage;
        }
    }

    public async getUIPackage() {
        if (!this._uiCache) {
            this._uiCache = await this.loadUIPackage();
        }
        return this._uiCache;
    }
}
