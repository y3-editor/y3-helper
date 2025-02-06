import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import { runShell } from '../runShell';
import * as l10n from '@vscode/l10n';


let paths = [
    '../LocalData/Patch/ExternalResource/tracy/Tracy.exe',
    '../Package/ExternalResource/tracy/Tracy.exe',
];

export async function launch() {
    if (!y3.env.editorUri) {
        return false;
    }
    for (let path of paths) {
        const tracyUri = vscode.Uri.joinPath(y3.env.editorUri, path);
        if (!await y3.fs.isExists(tracyUri)) {
            continue;
        }
        const code = await runShell(l10n.t('启动 Tracy'), `${tracyUri.fsPath}`, [
            "-a", "127.0.0.1",
        ]);

        return code === 0;
    }
    return false;
}
