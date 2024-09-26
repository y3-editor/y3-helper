import * as vscode from 'vscode';

export async function runShell(title: string, command: string, args: string[], cwd?: vscode.Uri) {
    let task = await vscode.tasks.executeTask(new vscode.Task(
        { type: 'shell' },
        vscode.TaskScope.Global,
        title,
        'y3-helper',
        new vscode.ShellExecution(command, args, cwd ? {
            cwd: cwd.fsPath,
        } : undefined),
    ));
    return await new Promise<number | undefined>((resolve) => {
        let disposable = vscode.tasks.onDidEndTaskProcess((taskProcess) => {
            if (task === taskProcess.execution) {
                disposable.dispose();
                resolve(taskProcess.exitCode);
            };
        });
    });
}
