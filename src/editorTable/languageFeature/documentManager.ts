import * as vscode from 'vscode';
import { EditorObject } from '../editorTable';
import * as y3 from 'y3-helper';

let objectMap: { [key: string]: EditorObject | null } = {};

export async function getObject(uri: vscode.Uri): Promise<EditorObject | undefined> {
    if (objectMap[uri.path] === undefined) {
        objectMap[uri.path] = await y3.table.getObject(uri) ?? null;
    }
    let object = objectMap[uri.path];
    return object ?? undefined;
}

export function init() {
    vscode.workspace.onDidChangeTextDocument((e) => {
        delete objectMap[e.document.uri.path];
    });
}
