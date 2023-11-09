import * as vscode from 'vscode';

export class GameLauncher {
    constructor() {
    }

    public async launch() {
        let scriptFolder = vscode.workspace.workspaceFolders?.[0];
        if (!scriptFolder) {
            vscode.window.showErrorMessage("没有打开工作目录！");
            return;
        }
        let editorUri = await searchY3Editor();
        if (!editorUri) {
            vscode.window.showErrorMessage("未找到编辑器！");
            return;
        }
        let mapPath = path.join(scriptFolder.uri.fsPath, '..');
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
