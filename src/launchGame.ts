import * as vscode from 'vscode';
import { env } from './env';
import { runElevated } from './launchAgent/runElevated';
import * as y3 from 'y3-helper';
import { updateHelperPortFile } from './console';
import * as l10n from '@vscode/l10n';
import { findDuplicateMultiPlayerRoles, findInvalidMultiPlayerRoles } from './multiPlayerRoles';
import { MultiPlayerArchiveAssignment, resolveLocalArchiveAssignments } from './multiPlayerArchives';


export interface LaunchOptions {
    luaArgs?: {[key: string]: string};
    multi?: number[];
    multiNicknames?: Record<number, string>;
    debugPlayers?: number[];
    tracy?: boolean;
    /** MCP 等无界面调用：不弹任何 VS Code 对话框，失败全部通过返回值报告 */
    silent?: boolean;
}

export interface LaunchError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

export interface LaunchResult {
    success: boolean;
    error?: LaunchError;
}

export class GameLauncher {
    private fail(
        options: LaunchOptions | undefined,
        code: string,
        message: string,
        details?: Record<string, unknown>,
    ): LaunchResult {
        if (!options?.silent) {
            vscode.window.showErrorMessage(message);
        }
        return {success: false, error: {code, message, details}};
    }

    private async runPlugin(map: y3.Map, options?: LaunchOptions): Promise<LaunchResult> {
        try {
            await y3.plugin.runAllPlugins(map, 'onGame');
        } catch (error) {
            const detail = String(error).replace(/Error: /, '');
            if (options?.silent) {
                return {
                    success: false,
                    error: {
                        code: 'PLUGIN_ERROR',
                        message: l10n.t("运行插件时发生错误"),
                        details: {detail},
                    },
                };
            }
            let res = await vscode.window.showErrorMessage(l10n.t("运行插件时发生错误"), {
                detail,
                modal: true,
            }, l10n.t('仍要启动'));
            if (res !== l10n.t('仍要启动')) {
                return {
                    success: false,
                    error: {
                        code: 'PLUGIN_ERROR',
                        message: l10n.t("运行插件时发生错误"),
                        details: {detail},
                    },
                };
            }
            return {success: true};
        }
        return {success: true};
    }

    public async launch(options?: LaunchOptions): Promise<LaunchResult> {
        await env.editorReady(!options?.silent);
        await env.mapReady(!options?.silent);
        let projectUri = env.projectUri;
        let editorExeUri = env.editorExeUri;
        let map = env.project?.selectedMap;
        if (!projectUri || !map) {
            return this.fail(options, 'MAP_NOT_SPECIFIED', l10n.t("没有指定地图目录！"));
        }
        if (!editorExeUri) {
            return this.fail(options, 'EDITOR_NOT_FOUND', l10n.t("未找到编辑器！"));
        }

        let archiveAssignments: MultiPlayerArchiveAssignment[] | undefined;
        if (options?.multi) {
            await env.project?.reloadMultiPlayerRoles();
            if (env.project?.multiPlayerRolesError) {
                return this.fail(
                    options,
                    'MULTI_ROLES_UNAVAILABLE',
                    l10n.t('无法读取阵营角色配置，请在编辑器中保存工程后重试。'),
                );
            }
            if (options.multi.length === 0) {
                return this.fail(
                    options,
                    'MULTI_PLAYERS_REQUIRED',
                    l10n.t('请至少选择一个玩家才能启动游戏！'),
                );
            }
            const duplicateRoles = findDuplicateMultiPlayerRoles(options.multi);
            if (duplicateRoles.length > 0) {
                return this.fail(
                    options,
                    'MULTI_PLAYERS_DUPLICATE',
                    l10n.t('玩家列表包含重复角色：{0}', duplicateRoles.join(', ')),
                    {roleIds: duplicateRoles},
                );
            }
            const invalidRoles = findInvalidMultiPlayerRoles(options.multi, env.project?.multiPlayerRoles ?? []);
            if (invalidRoles.length > 0) {
                return this.fail(
                    options,
                    'MULTI_PLAYERS_INVALID',
                    l10n.t('以下玩家已不在阵营配置中：{0}', invalidRoles.join(', ')),
                    {roleIds: invalidRoles},
                );
            }
            await env.project?.reloadMultiPlayerArchives();
            if (env.project?.multiPlayerArchivesError) {
                return this.fail(
                    options,
                    'MULTI_ARCHIVE_INVALID',
                    l10n.t('无法读取本地存档配置，请检查 archive/archive_storage.json。'),
                );
            }
            const resolvedArchives = resolveLocalArchiveAssignments(
                options.multi,
                options.multiNicknames,
                env.project?.multiPlayerArchives ?? {},
            );
            archiveAssignments = resolvedArchives.assignments;
            if (resolvedArchives.missingRoleIds.length > 0) {
                return this.fail(
                    options,
                    'MULTI_NICKNAME_MISSING',
                    l10n.t(
                        '以下玩家未选择本地玩家昵称：{0}',
                        resolvedArchives.missingRoleIds.join(', '),
                    ),
                    {roleIds: resolvedArchives.missingRoleIds},
                );
            }
        }

        if (!options?.silent && await y3.version.askUpdate()) {
            return {
                success: false,
                error: {
                    code: 'EDITOR_UPDATE_REQUIRED',
                    message: l10n.t('编辑器有新版本，请更新后再启动游戏。'),
                },
            };
        }

        const pluginResult = await this.runPlugin(map, options);
        if (!pluginResult.success) {
            return pluginResult;
        }

        if (archiveAssignments) {
            try {
                await env.project?.saveMultiPlayerArchiveAssignments(archiveAssignments);
            } catch (error) {
                y3.log.error(l10n.t('写入本地存档配置失败：{0}', String(error)));
                return this.fail(
                    options,
                    'MULTI_ARCHIVE_WRITE_FAILED',
                    l10n.t('写入本地存档配置失败，请检查 archive/archive_storage.json。'),
                    {detail: String(error)},
                );
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
        if (options?.multi && !options.silent) {
            vscode.window.showInformationMessage(l10n.t("正在以多开模式启动，若无法启动或看到“错误码：54”，请手动启动编辑器登录（并选择30天免登录）再使用此功能"));
        }

        await updateHelperPortFile();

        let code = await runElevated(
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
            return this.fail(options, 'GAME_LAUNCH_FAILED', l10n.t("启动游戏失败！"));
        }

        if (options?.tracy) {
            await y3.tracy.launch();
        }

        return {success: true};
    }
}
