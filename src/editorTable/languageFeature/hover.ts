import * as vscode from 'vscode';
import { getObject } from '../editorTable';
import * as jsonc from 'jsonc-parser';

class Provider implements vscode.HoverProvider {
    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
        const object = await getObject(document.uri);
        if (!object) {
            return;
        }

        let root = object.tree;
        if (!root) {
            return;
        }

        let node = jsonc.findNodeAtOffset(root, document.offsetAt(position));
        if (
          !node ||
          node.parent?.type !== "property" ||
          node.parent?.parent !== root
        ) {
          return;
        }

        let key = node.parent.children![0].value;
        if (typeof key !== "string") {
            return;
        }

        const info = object.getFieldInfo(key);
        if (!info.desc) {
            return;
        }

        const md = new vscode.MarkdownString(`${info.desc}`);
        if (info.tips) {
            md.appendCodeblock(info.tips, 'text');
        }
        return new vscode.Hover(md);
    }
}

export function init() {
    vscode.languages.registerHoverProvider({
        scheme: 'file',
        language: 'json',
    }, new Provider());
}
