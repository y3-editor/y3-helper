import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as jsonc from 'jsonc-parser';
import { getObject } from './documentManager';

class Provider implements vscode.DocumentSymbolProvider {
    private makeSymbole(document: vscode.TextDocument, object: y3.table.EditorObject, child: jsonc.Node) {
        if (child.type !== 'property') {
            return;
        }
        const fieldNode = child.children![0];
        const field: string = fieldNode.value;
        const info = object.getFieldInfo(field);
        if (!info?.desc) {
            return undefined;
        }
        let symbol = new vscode.DocumentSymbol(
            info.desc,
            info.tips ?? '',
            vscode.SymbolKind.Property,
            new vscode.Range(
                document.positionAt(child.offset),
                document.positionAt(child.offset + child.length),
            ),
            new vscode.Range(
                document.positionAt(fieldNode.offset),
                document.positionAt(fieldNode.offset + fieldNode.length),
            ),
        );
        return symbol;
    }

    async provideDocumentSymbols(document: vscode.TextDocument) {
        const uri = document.uri;
        let object = await getObject(uri);
        if (!object) {
            return;
        }
        let tree = object.tree;
        if (!tree || !tree.children) {
            return;
        }
        let result: vscode.DocumentSymbol[] = [];
        for (const child of tree.children) {
            let symbol = this.makeSymbole(document, object, child);
            if (symbol) {
                result.push(symbol);
            }
        }
        return result;
    }
}

export function init() {
    vscode.languages.registerDocumentSymbolProvider({
        scheme: 'file',
        language: 'json',
    }, new Provider(), {
        label: 'Y3开发助手：物编字段',
    });
}
