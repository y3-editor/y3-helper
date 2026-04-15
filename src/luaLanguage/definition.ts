import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

export class DefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.DefinitionLink[] | null> {
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
        let results: vscode.DefinitionLink[] = [];

        for (const object of objects) {
            if (!object.uri) {
                continue;
            }
            results.push({
                targetUri: object.uri,
                targetRange: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
            });
        }
        
        return results;
    }
}
