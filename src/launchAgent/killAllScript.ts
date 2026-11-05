/**
 * 生成提权代理清理游戏进程的 PowerShell 脚本。
 *
 * 优先按 editor_map_path 精确匹配当前工程，避免误杀编辑器；
 * 没有工程路径时退回“allowDir 下的 Python 启动进程”匹配。
 */
export function buildKillAllScript(
    projectPath: string | undefined,
    allowDir: string,
    exeName = 'game_x64h.exe',
): string {
    const escape = (value: string) => value.replace(/'/g, "''");
    const marker = projectPath ? escape(projectPath) : '';
    const filter = marker
        ? `$_.CommandLine -like '*editor_map_path@${marker}*'`
        : `$_.ExecutablePath -like '*${escape(allowDir)}*' -and $_.CommandLine -like '*--start=Python*'`;
    return [
        `$procs = @(Get-CimInstance Win32_Process -Filter "Name='${exeName}'" | Where-Object { ${filter} })`,
        '$count = 0',
        'foreach ($p in $procs) { taskkill /PID $p.ProcessId /T /F | Out-Null; if ($LASTEXITCODE -eq 0) { $count++ } }',
        'Write-Output $count',
    ].join('; ');
}
