import * as vscode from 'vscode';
import { env } from './env';
import { runShell } from './runShell';

export class GameLauncher {

    public async launch(luaArgs?: {[key: string]: string|number|boolean}): Promise<boolean> {
        await env.editorReady(true);
        await env.mapReady(true);
        let projectUri = env.projectUri;
        let editorExeUri = env.editorExeUri;
        if (!projectUri) {
            vscode.window.showErrorMessage("没有指定地图目录！");
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
