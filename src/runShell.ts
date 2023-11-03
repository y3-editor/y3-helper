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
    await new Promise<void>((resolve) => {
        let disposable = vscode.tasks.onDidEndTask((taskEndEvent) => {
            if (task === taskEndEvent.execution) {
                disposable.dispose();
                resolve();
            };
        });
    });
}
