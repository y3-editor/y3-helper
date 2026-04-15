import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

export class HoverProvider implements vscode.HoverProvider {
    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | null> {
        let range = document.getWordRangeAtPosition(position);
        let text = document.getText(range);
        let key = Number(text);
        if (!Number.isInteger(key)) {
            return null;
        }
        let objects = await y3.table.getObjectsByKey(key);
        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        if (objects.length === 0) {
            return null;
        }
        let results = [];
        for (let object of objects) {
            results.push(`${object.name}(${object.tableName})`);
        }
        return new vscode.Hover(results, range);
    }
}
