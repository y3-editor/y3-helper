import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

export class InlayHintProvider implements vscode.InlayHintsProvider {
    async provideInlayHints(document: vscode.TextDocument, range: vscode.Range, token: vscode.CancellationToken): Promise<vscode.InlayHint[] | null> {
        let text = document.getText(range);
        let startOffset = document.offsetAt(range.start);

        let hints: vscode.InlayHint[] = [];
        // 捕获字符串中的所有整数以及它们的位置
        let reg = /(\d+)/g;
        let match;
        while (match = reg.exec(text)) {
            let start = document.positionAt(startOffset + match.index + match[0].length);
            let key = Number(match[0]);
            if (key <= 10000) {
                continue;
            }
            let objects = await y3.table.getObjectsByKey(key);
            if (token.isCancellationRequested) {
                throw new vscode.CancellationError();
            }
            if (objects.length === 0) {
                continue;
            }
            let name = objects.map(object => object.name).join('|');
            hints.push(new vscode.InlayHint(start, name));
        }
        if (hints.length === 0) {
            return null;
        }
        return hints;
    }
}
