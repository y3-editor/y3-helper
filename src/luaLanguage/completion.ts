import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

export class CompletionProvider implements vscode.CompletionItemProvider {
    private async provideByKey(text: string, token: vscode.CancellationToken): Promise<vscode.CompletionItem[] | null> {
        let key = Number(text);
        if (!Number.isInteger(key)) {
            return null;
        }
        let objects = await y3.table.getAllObjects();
        if (token.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        let results: vscode.CompletionItem[] = [];

        for (const object of objects) {
            if (object.key.toString().startsWith(text)) {
                let item = new vscode.CompletionItem(object.key.toString(), vscode.CompletionItemKind.Unit);
                item.documentation = `${object.name}(${object.tableName})`;
                results.push(item);
            }
        }

        return results;
    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): Promise<vscode.CompletionItem[] | null> {
        if (context.triggerCharacter === '?') {
            return await this.provideByKey('', token);
        } else {
            let range = document.getWordRangeAtPosition(position);
            let text = document.getText(range);
            return await this.provideByKey(text, token);
        }
    }
}
