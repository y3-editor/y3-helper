import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import { runShell } from '../runShell';

export async function launch() {
    if (!y3.env.editorUri) {
        return false;
    }
    const tracyUri = vscode.Uri.joinPath(y3.env.editorUri, '../LocalData/Patch/ExternalResource/tracy/Tracy.exe');
    if (!await y3.fs.isExists(tracyUri)) {
        return false;
    }
    const code = await runShell('启动 Tracy', `${tracyUri.fsPath}`, [
        "-a", "127.0.0.1",
    ]);

    return code === 0;
}
