import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import { spawn } from 'child_process';
import { env } from './env';
import { getLaunchAgent } from './launchAgent/manager';
import * as tools from './tools';

/** 游戏主程序名，与提权代理的启动白名单一致 */
const GAME_EXE = 'Game_x64h.exe';

function runPowerShell(script: string): Promise<string> {
    return new Promise((resolve) => {
        let child = spawn('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-Command', script,
        ], { windowsHide: true });
        let output = '';
        child.stdout.on('data', (chunk) => output += chunk.toString());
        child.on('error', () => resolve(''));
        child.on('close', () => resolve(output));
    });
}

/**
 * 兜底：按命令行里的 editor_map_path 匹配本工程的游戏进程。
 * 只能终止非提权进程，管理员权限启动的游戏要靠提权代理。
 */
async function killByCommandLine(projectPath: string): Promise<number> {
    if (process.platform !== 'win32') {
        return 0;
    }
    let marker = projectPath.replace(/'/g, "''");
    let script = [
        `$procs = @(Get-CimInstance Win32_Process -Filter "Name='${GAME_EXE}'" | Where-Object { $_.CommandLine -like '*editor_map_path@${marker}*' })`,
        'foreach ($p in $procs) { taskkill /PID $p.ProcessId /T /F | Out-Null }',
        'Write-Output $procs.Count',
    ].join('; ');
    let output = await runPowerShell(script);
    let count = Number.parseInt(output.trim(), 10);
    return Number.isNaN(count) ? 0 : count;
}

export async function killGame(): Promise<void> {
    let agent = getLaunchAgent();
    let killedByAgent = agent ? await agent.kill() : 0;

    let projectPath = env.projectUri?.fsPath;
    let killedByCommandLine = projectPath ? await killByCommandLine(projectPath) : 0;

    let total = killedByAgent + killedByCommandLine;
    tools.log.info(`[Y3-Helper] 关闭游戏进程：提权代理 ${killedByAgent} 个，命令行匹配 ${killedByCommandLine} 个`);
    if (total === 0) {
        vscode.window.showInformationMessage(l10n.t('未找到正在运行的游戏进程'));
        return;
    }
    vscode.window.showInformationMessage(l10n.t('已关闭 {0} 个游戏进程', String(total)));
}
