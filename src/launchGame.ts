import * as vscode from 'vscode';
import { env } from './env';
import { runShell } from './runShell';
import * as y3 from 'y3-helper';
import { updateHelperPortFile } from './console';
import * as l10n from '@vscode/l10n';
import { findDuplicateMultiPlayerRoles, findInvalidMultiPlayerRoles } from './multiPlayerRoles';
import { MultiPlayerArchiveAssignment, resolveLocalArchiveAssignments } from './multiPlayerArchives';


interface LaunchOptions {
    luaArgs?: {[key: string]: string};
    multi?: number[];
    multiNicknames?: Record<number, string>;
    debugPlayers?: number[];
    tracy?: boolean;
}

export class GameLauncher {
    private async runPlugin(map: y3.Map) {
        try {
            await y3.plugin.runAllPlugins(map, 'onGame');
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
        let map = env.project?.selectedMap;
        if (!projectUri || !map) {
            vscode.window.showErrorMessage(l10n.t("没有指定地图目录！"));
            return false;
        }
        if (!editorExeUri) {
            vscode.window.showErrorMessage(l10n.t("未找到编辑器！"));
            return false;
        }

        let archiveAssignments: MultiPlayerArchiveAssignment[] | undefined;
        if (options?.multi) {
            await env.project?.reloadMultiPlayerRoles();
            if (env.project?.multiPlayerRolesError) {
                vscode.window.showErrorMessage(l10n.t('无法读取阵营角色配置，请在编辑器中保存工程后重试。'));
                return false;
            }
            if (options.multi.length === 0) {
                vscode.window.showErrorMessage(l10n.t('请至少选择一个玩家才能启动游戏！'));
                return false;
            }
            const duplicateRoles = findDuplicateMultiPlayerRoles(options.multi);
            if (duplicateRoles.length > 0) {
                vscode.window.showErrorMessage(l10n.t('玩家列表包含重复角色：{0}', duplicateRoles.join(', ')));
                return false;
            }
            const invalidRoles = findInvalidMultiPlayerRoles(options.multi, env.project?.multiPlayerRoles ?? []);
            if (invalidRoles.length > 0) {
                vscode.window.showErrorMessage(l10n.t('以下玩家已不在阵营配置中：{0}', invalidRoles.join(', ')));
                return false;
            }
            await env.project?.reloadMultiPlayerArchives();
            if (env.project?.multiPlayerArchivesError) {
                vscode.window.showErrorMessage(l10n.t('无法读取本地存档配置，请检查 archive/archive_storage.json。'));
                return false;
            }
            const resolvedArchives = resolveLocalArchiveAssignments(
                options.multi,
                options.multiNicknames,
                env.project?.multiPlayerArchives ?? {},
            );
            archiveAssignments = resolvedArchives.assignments;
            if (resolvedArchives.missingRoleIds.length > 0) {
                vscode.window.showErrorMessage(l10n.t(
                    '以下玩家未选择本地玩家昵称：{0}',
                    resolvedArchives.missingRoleIds.join(', '),
                ));
                return false;
            }
        }

        if (await y3.version.askUpdate()) {
            return false;
        }

        let suc = await this.runPlugin(map);
        if (!suc) {
            return false;
        }

        if (archiveAssignments) {
            try {
                await env.project?.saveMultiPlayerArchiveAssignments(archiveAssignments);
            } catch (error) {
                y3.log.error(l10n.t('写入本地存档配置失败：{0}', String(error)));
                vscode.window.showErrorMessage(l10n.t('写入本地存档配置失败，请检查 archive/archive_storage.json。'));
                return false;
            }
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
        args.push(`level_id@${map.id}`);
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
