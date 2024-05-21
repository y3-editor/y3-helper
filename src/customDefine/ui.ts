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

    private async loadUIFile(fileUri: vscode.Uri): Promise<Node|undefined> {
        let jsonText = (await tools.readFile(fileUri))?.string;
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

    private async loadPrefeb(fileUri: vscode.Uri) {
        let nodes: Node[] = [];

        let jsonText = (await tools.readFile(fileUri))?.string;
        if (!jsonText) {
            return nodes;
        }
        try {
            let json = JSON.parse(jsonText);
            if (typeof json !== 'object') {
                return nodes;
            }

            let prefab_data = json['prefab_data'];
            if (!prefab_data || typeof prefab_data !== 'object') {
                return nodes;
            }

            for (const key in prefab_data) {
                let prefeb = prefab_data[key];
                let node = this.makeNode(prefeb['data']);
                if (node) {
                    nodes.push(node);
                }
            }
            return nodes;
        } catch(e) {
            tools.log.error(e as Error);
        }
    }

    private async loadUI() {
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
                        let node = await this.loadUIFile(uri);
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

    public async getUI() {
        if (!this._uiCache) {
            this._uiCache = await this.loadUI();
        }
        return this._uiCache;
    }
}
