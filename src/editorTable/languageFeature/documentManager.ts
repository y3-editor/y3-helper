import * as vscode from 'vscode';
import { EditorObject } from '../editorTable';
import * as y3 from 'y3-helper';
import { queue } from '../../utility/decorators';

let objectMap: { [key: string]: EditorObject | null } = {};

class Manager {
    @queue()
    async getObject(uri: vscode.Uri): Promise<EditorObject | undefined> {
        if (objectMap[uri.path] === undefined) {
            objectMap[uri.path] = await y3.table.getObject(uri) ?? null;
        }
        let object = objectMap[uri.path];
        return object ?? undefined;
    }
}

const ManagerInstance = new Manager();

export async function getObject(uri: vscode.Uri): Promise<EditorObject | undefined> {
    return await ManagerInstance.getObject(uri);
}

export function init() {
    vscode.workspace.onDidChangeTextDocument((e) => {
        delete objectMap[e.document.uri.path];
    });
}
