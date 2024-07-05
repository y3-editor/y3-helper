import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import { Table } from '../constants';
import { EditorObject } from './editorTable';

let objectMap: { [key: string]: EditorObject | null } = {};

export class Provider implements vscode.DocumentSymbolProvider {
    async provideDocumentSymbols(document: vscode.TextDocument) {
        const uri = document.uri;
        if (objectMap[uri.path] === undefined) {
            objectMap[uri.path] = await y3.table.getObject(uri) ?? null;
        }
        let object = objectMap[uri.path];
        if (object === null) {
            return;
        }
        return undefined;
    }
}

export function init() {
    vscode.languages.registerDocumentSymbolProvider({
        scheme: 'file',
        language: 'json',
    }, new Provider());
    vscode.workspace.onDidChangeTextDocument((e) => {
        delete objectMap[e.document.uri.path];
    });
}
