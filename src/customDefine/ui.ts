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

    private async loadUIFile(fileUri: vscode.Uri): Promise<Node|undefined> {
        let jsonText = (await tools.readFile(fileUri))?.string;
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

        function makeNode(object: any): Node | undefined {
            if (typeof object !== 'object') {
                return;
            }
            return {
                name: object['name'],
                uid: object['uid'],
                type: object['type'],
                childs: object['children']?.map(makeNode) ?? [],
            };
        }

        return makeNode(json);
    }

    private async loadUI() {
        let nodes: UIPackage = {
            画板: [],
            场景UI: [],
            元件: [],
        };
        try {
            if (!env.mapUri) {
                return nodes;
            }
            let dir = vscode.Uri.joinPath(env.mapUri, dirPath);
            let files = await vscode.workspace.fs.readDirectory(dir);
            for (let [fileName, fileType] of files) {
                if (fileType !== vscode.FileType.File) {
                    continue;
                };
                if (fileName === 'SceneUI.json') {
                    continue;
                };
                if (fileName === 'ui_config.json') {
                    continue;
                };
                if (!fileName.endsWith('.json')) {
                    continue;
                };
                let node = await this.loadUIFile(vscode.Uri.joinPath(dir, fileName));
                if (node) {
                    nodes.画板.push(node);
                }
            }
        } finally {
            return nodes;
        }
    }

    public async getUI() {
        if (!this._uiCache) {
            this._uiCache = await this.loadUI();
        }
        return this._uiCache;
    }
}
