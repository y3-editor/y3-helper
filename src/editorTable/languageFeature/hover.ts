import * as vscode from 'vscode';
import { getObject } from './documentManager';
import * as jsonc from 'jsonc-parser';
import * as y3 from 'y3-helper';

class FieldProvider implements vscode.HoverProvider {
    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
        const object = await getObject(document.uri);
        if (!object) {
            return;
        }

        let root = object.json?.tree;
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
        if (!info?.desc) {
            return;
        }

        const md = new vscode.MarkdownString(`${info.desc}`);
        if (info.tips) {
            md.appendCodeblock(info.tips, 'text');
        }
        return new vscode.Hover(md);
    }
}

class UnicodeProvider implements vscode.HoverProvider {
    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
        const object = await getObject(document.uri);
        if (!object?.json?.tree) {
            return;
        }

        const node = jsonc.findNodeAtOffset(object.json.tree, document.offsetAt(position));

        if (node?.type !== 'string') {
            return;
        }

        const raw = object.text!.slice(node.offset + 1, node.offset + node.length - 1);
        if (raw === node.value) {
            return;
        }

        return new vscode.Hover(new vscode.MarkdownString(`"${node.value}"`));
    }
}

class TranslateProvider implements vscode.HoverProvider {
    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
        const object = await getObject(document.uri);
        if (!object?.json?.tree) {
            return;
        }

        const node = jsonc.findNodeAtOffset(object.json.tree, document.offsetAt(position));
        if (node?.type !== 'number') {
            return;
        }

        const text = y3.env.currentTriggerMap?.language.get(node.value);
        if (!text) {
            return;
        }

        return new vscode.Hover(new vscode.MarkdownString(`"${text}"`));
    }
}

export function init() {
    vscode.languages.registerHoverProvider({
        scheme: 'file',
        language: 'json',
    }, new FieldProvider());

    vscode.languages.registerHoverProvider({
        scheme: 'file',
        language: 'json',
    }, new UnicodeProvider());

    vscode.languages.registerHoverProvider({
        scheme: 'file',
        language: 'json',
    }, new TranslateProvider());
}
