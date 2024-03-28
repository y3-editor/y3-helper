import * as vscode from 'vscode';
import { Env } from './env';
import * as path from 'path';
import { runShell } from './runShell';

export class GameLauncher {
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    public async launch(luaArgs?: {[key: string]: string|number|boolean}): Promise<boolean> {
        await this.env.waitReady(true);
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
        let args = [];
        args.push('type@editor_game');
        args.push('subtype@editor_game');
        args.push('release@true');
        args.push('editor_map_path@' + projectUri.fsPath);
        if (luaArgs) {
            for (let key in luaArgs) {
                args.push(key + "@" + luaArgs[key].toString());
            }
        }
        await runShell(
            "启动游戏",
            editorExeUri.fsPath,
            [
                "--dx11",
                "--console",
                "--luaconsole",
                "--start=Python",
                "--python-args=" + args.join(","),
                "--plugin-config=Plugins-PyQt",
                //"--python-builtin-path=E:/up1-uat/src/Server/server/engine",
                //"--python-debug=1",
            ],
            vscode.Uri.joinPath(editorExeUri, "..")
        );
        return true;
    }
}
