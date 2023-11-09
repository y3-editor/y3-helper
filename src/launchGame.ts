import * as vscode from 'vscode';
import { Env } from './env';
import * as path from 'path';
import { runShell } from './runShell';

export class GameLauncher {
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    public async launch() {
        let scriptUri = this.env.scriptUri;
        let editorUri = this.env.editorUri;
        if (!scriptUri) {
            vscode.window.showErrorMessage("没有打开工作目录！");
            return;
        }
        if (!editorUri) {
            vscode.window.showErrorMessage("未找到编辑器！");
            return;
        }
        let mapPath = path.join(scriptUri.fsPath, '..');
        await runShell(
            "启动游戏",
            editorUri.fsPath,
            [
                "-dx11",
                "-console",
                "-start=Python",
                "-python-args=type@editor_game,subtype@editor_game,release@true,editor_map_path@" + mapPath,
                "-plugin-config=Plugins-PyQt",
                "-python-debug=1",
            ],
        );
    }
}
