import * as vscode from 'vscode';
import { Env } from './env';
import * as path from 'path';
import { runShell } from './runShell';

export class GameLauncher {
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    public async launch(): Promise<boolean> {
        await this.env.waitReady();
        let projectUri = this.env.projectUri;
        let editorExeUri = this.env.editorExeUri;
        if (!projectUri) {
            vscode.window.showErrorMessage("没有打开工作目录！");
            return false;
        }
        if (!editorExeUri) {
            vscode.window.showErrorMessage("未找到编辑器！");
            return false;
        }
        await runShell(
            "启动游戏",
            editorExeUri.fsPath,
            [
                "--dx11",
                "--console",
                "--start=Python",
                "--python-args=type@editor_game,subtype@editor_game,release@true,editor_map_path@" + projectUri.fsPath,
                "--plugin-config=Plugins-PyQt",
                "--python-debug=1",
            ],
            vscode.Uri.joinPath(editorExeUri, "..")
        );
        return true;
    }
}
