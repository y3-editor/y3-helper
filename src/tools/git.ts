import * as cp from 'child_process';

export interface GitResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface ExecGitOptions {
    timeoutMs?: number;
    env?: Record<string, string>;
}

export function execGit(args: string[], cwd: string, options: ExecGitOptions = {}): Promise<GitResult> {
    return new Promise((resolve) => {
        const execOptions: cp.ExecFileOptions = {
            cwd,
            timeout: options.timeoutMs,
            windowsHide: true,
            encoding: 'utf8',
        };
        if (options.env) {
            execOptions.env = { ...process.env, ...options.env };
        }
        cp.execFile('git', args, execOptions, (error, stdout, stderr) => {
            const code: unknown = error?.code;
            resolve({
                stdout: String(stdout ?? '').trim(),
                stderr: String(stderr ?? '').trim(),
                exitCode: error ? (typeof code === 'number' ? code : 1) : 0,
            });
        });
    });
}
