import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import * as y3 from 'y3-helper';

export class RunButtonProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    public async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[] | undefined> {
        if (!y3.env.project) {
            return undefined;
        }
        let pluginInstance = await y3.plugin.findPlugin(document.uri);
        if (!pluginInstance) {
            return undefined;
        }
        let codeLens: vscode.CodeLens[] = [];
        let infos = await pluginInstance.getExports();
        for (const name in infos) {
            const info = infos[name];
            codeLens.push(new vscode.CodeLens(new vscode.Range(info.line, 0, info.line, 0), {
                title: l10n.t('$(debug-start)运行 "{0}"', name),
                command: 'y3-helper.runPlugin',
                arguments: [document.uri, name],
            }));
            if (name === 'onGame') {
                codeLens.push(new vscode.CodeLens(new vscode.Range(info.line, 0, info.line, 0), {
                    title: l10n.t('使用《Y3开发助手》启动游戏时自动运行'),
                    command: '',
                }));
            } else if (name === 'onEditor') {
                codeLens.push(new vscode.CodeLens(new vscode.Range(info.line, 0, info.line, 0), {
                    title: l10n.t('使用《Y3开发助手》的“在编辑器中打开”时自动运行'),
                    command: '',
                }));
            } else if (name === 'onSave') {
                codeLens.push(new vscode.CodeLens(new vscode.Range(info.line, 0, info.line, 0), {
                    title: l10n.t('使用《Y3编辑器》保存地图后自动运行'),
                    command: '',
                }));
            }
        }
        return codeLens;
    }

    public notifyChange() {
        this._onDidChangeCodeLenses.fire();
    }
}
