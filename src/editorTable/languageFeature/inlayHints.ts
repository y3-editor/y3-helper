import * as vscode from 'vscode';
import { getObject } from '../editorTable';

class Provider implements vscode.InlayHintsProvider {
    async provideInlayHints(document: vscode.TextDocument, range: vscode.Range) {
        const object = await getObject(document.uri);
        if (!object) {
            return;
        }

        const root = object.json?.tree;
        if (!root) {
            return;
        }

        const start = document.offsetAt(range.start);
        const end = document.offsetAt(range.end);
        const result: vscode.InlayHint[] = [];

        for (const property of root.children!) {
            const key = property.children![0];
            if (key.offset > end || key.offset + key.length < start) {
                continue;
            }
            const info = object.getFieldInfo(key.value);
            if (!info?.desc) {
                continue;
            }
            result.push(new vscode.InlayHint(
                document.positionAt(key.offset + key.length),
                info.desc,
            ));
        }

        return result;
    }
}

export function init() {
    vscode.languages.registerInlayHintsProvider({
        scheme: 'file',
        language: 'json',
    }, new Provider());
}
