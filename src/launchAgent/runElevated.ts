import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import * as tools from '../tools';
import { runShell } from '../runShell';
import { getLaunchAgent } from './manager';

/**
 * 与 runShell 同形的启动入口：优先通过提权代理启动，避免每次弹 UAC；
 * 代理不可用时回退到直接启动。
 */
export async function runElevated(title: string, command: string, args: string[], cwd?: vscode.Uri): Promise<number | undefined> {
    let manager = getLaunchAgent();
    if (process.platform === 'win32' && manager) {
        try {
            return await manager.launch(command, args, cwd?.fsPath);
        } catch (error) {
            tools.log.warn(l10n.t('提权代理不可用，回退到直接启动：{0}', String(error)));
        }
    }
    return await runShell(title, command, args, cwd);
}
