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
            let objects = await y3.table.getObjectsByKey(Number(match[0]));
            if (token.isCancellationRequested) {
                throw new vscode.CancellationError();
            }
            if (objects.length === 0) {
                continue;
            }
            for (let object of objects) {
                hints.push(new vscode.InlayHint(start, object.name));
            }
        }
        if (hints.length === 0) {
            return null;
        }
        return hints;
    }
}
