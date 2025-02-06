import * as vscode from 'vscode';
import { env } from './env';
import { runShell } from './runShell';
import * as y3 from 'y3-helper';
import { updateHelperPortFile } from './console';

const l10n = vscode.l10n;

interface LaunchOptions {
    luaArgs?: {[key: string]: string};
    multi?: number[];
    debugPlayers?: number[];
    tracy?: boolean;
}

export class GameLauncher {
    private async runPlugin() {
        try {
            await y3.plugin.runAllPlugins('onGame');
        } catch (error) {
            let res = await vscode.window.showErrorMessage(l10n.t("运行插件时发生错误"), {
                detail: String(error).replace(/Error: /, ''),
                modal: true,
            }, l10n.t('仍要启动'));
            if (res !== l10n.t('仍要启动')) {
                return false;
            }
            return true;
        }
        return true;
    }

    public async launch(options?: LaunchOptions): Promise<boolean> {
        await env.editorReady(true);
        await env.mapReady(true);
        let projectUri = env.projectUri;
        let editorExeUri = env.editorExeUri;
        if (!projectUri) {
            vscode.window.showErrorMessage(l10n.t("没有指定地图目录！"));
            return false;
        }
        if (!editorExeUri) {
            vscode.window.showErrorMessage(l10n.t("未找到编辑器！"));
            return false;
        }

        if (await y3.version.askUpdate()) {
            return false;
        }

        let suc = await this.runPlugin();
        if (!suc) {
            return false;
        }

        let args = [];
        if (options?.multi) {
            args.push('type@editor_game');
            args.push('subtype@editor_multi_game');
            args.push('role_ids@' + options.multi.join('#'));
            args.push('editor_map_path@' + projectUri.fsPath);
        } else {
            args.push('type@editor_game');
            args.push('subtype@editor_game');
            args.push('editor_map_path@' + projectUri.fsPath);
        }
        args.push('release@true');
        args.push('lua_dummy@sp ce');
        if (options?.luaArgs) {
            for (let key in options.luaArgs) {
                args.push(key + "@" + options.luaArgs[key]);
            }
        }
        if (options?.multi) {
            vscode.window.showInformationMessage(l10n.t("正在以多开模式启动，若无法启动或看到“错误码：54”，请手动启动编辑器登录（并选择30天免登录）再使用此功能"));
        }

        await updateHelperPortFile();

        let code = await runShell(
            l10n.t("启动游戏"),
            editorExeUri.fsPath,
            [
                '--dx11',
                "--start=Python",
                "--python-args=" + args.join(","),
                "--plugin-config=Plugins-PyQt",
                //"--python-builtin-path=E:/up1-uat/src/Server/server/engine",
                //"--python-debug=1",
                ...(options?.multi ? [] : ['--console', '--luaconsole']),
            ],
            vscode.Uri.joinPath(editorExeUri, "..")
        );
        if (code !== 0) {
            vscode.window.showErrorMessage(l10n.t("启动游戏失败！"));
            return false;
        }

        if (options?.tracy) {
            await y3.tracy.launch();
        }

        return true;
    }
}
