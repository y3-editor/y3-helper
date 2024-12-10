import * as vscode from 'vscode';
import { env } from './env';
import { runShell } from './runShell';
import * as y3 from 'y3-helper';

export class EditorLauncher {
    private async runPlugin() {
        try {
            await y3.plugin.runAllPlugins('onEditor');
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

        if (await y3.version.askUpdate()) {
            return false;
        }

        await this.runPlugin();

        let project_path = projectUri.fsPath.replaceAll("\\", "/") + '/header.project';
        let project_path_base64 = Buffer.from(project_path).toString('base64');
        let args = [];
        args.push('type@editor');
        args.push('subtype@author');
        args.push('release@true');
        args.push('project_path@' + project_path_base64);
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
