import * as vscode from 'vscode';
import { env } from './env';
import { runShell } from './runShell';
import * as y3 from 'y3-helper';

export class GameLauncher {
    private async runPlugin() {
        try {
            await y3.plugin.runAllPlugins('onGame');
        } catch (error) {
            let res = await vscode.window.showErrorMessage("运行插件时发生错误", {
                detail: String(error).replace(/Error: /, ''),
                modal: true,
            }, '仍要启动');
            if (res !== '仍要启动') {
                return false;
            }
        }
    }

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

        await this.runPlugin();

        let args = [];
        args.push('type@editor_game');
        args.push('subtype@editor_game');
        args.push('release@true');
        args.push('editor_map_path@' + projectUri.fsPath);
        args.push('lua_dummy@sp ce');
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
