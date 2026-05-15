/**
 * run_terminal_cmd 工具（对齐上游 src/utils/terminal/index.ts）
 *
 * Y3Helper 简化版：
 *   - 使用 child_process.spawn 执行命令（上游基于 TerminalManager + TerminalProcess）
 *   - 保留实时 TERMINAL_TRANSFER_LOG 消息推送
 *   - 保留交互式提示检测（自动终止进程并让 AI 改用 ask_user_question）
 *   - 保留 .y3makerignore 访问控制
 */
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as iconv from 'iconv-lite';
import { checkTerminalCommandAccess } from '../commandParser';
import type { ExecuteCommandResult, ToolProvider } from '../executeFunction';

// 对齐源码版 ETerminalStatus 枚举
const ETerminalStatus = {
    START: '',
    CANCELED: 'Canceled',
    RUNNING: 'Running',
    FAILED: 'Failed',
    SUCCESS: 'Success',
} as const;

export interface RunTerminalCmdParams {
    command: string;
    messageId?: string;
    is_approve?: boolean;
}

/**
 * run_terminal_cmd 工具：在终端中执行命令
 * 对齐源码版 TerminalManager 的完整流程：
 * 1. 发送 TERMINAL_TRANSFER_LOG (status: START) 通知前端命令开始
 * 2. 使用 spawn 执行命令，实时发送 TERMINAL_TRANSFER_LOG (status: RUNNING) 推送输出
 * 3. 命令结束后返回 TOOL_CALL_RESULT (terminalStatus: Success/Failed)
 */
export default async function runTerminalCmd(
    params: RunTerminalCmdParams,
    toolId: string,
    provider: ToolProvider,
    isRtk: boolean = false,
): Promise<ExecuteCommandResult> {
    const command = params?.command;
    const messageId = params?.messageId || '';
    const terminalId = toolId || '';

    if (!command) {
        return { content: 'Error: command is required.', isError: true, path: '' };
    }

    const ETS = ETerminalStatus;
    const result: ExecuteCommandResult & { extra: any } = {
        content: 'The user is not allowed to execute commands',
        path: command,
        isError: false,
        extra: {
            messageId: messageId,
            terminalId: terminalId,
            terminalStatus: ETS.START as string,
            hasShellIntegration: false,
            status: ETS.START as string,
            isRtk: !!isRtk,
        },
    };

    // 发送 TERMINAL_TRANSFER_LOG 消息给前端（对齐源码版 sendLog）
    const sendTerminalLog = (log: string, status: string, isHot: boolean = false) => {
        provider.sendMessage({
            type: 'TERMINAL_TRANSFER_LOG',
            data: {
                messageId,
                terminalId,
                log,
                extra: {
                    terminalStatus: status,
                    hasShellIntegration: isHot,
                    status: isHot ? ETS.RUNNING : ETS.START,
                    isRtk: !!isRtk,
                },
            },
        });
    };

    if (!params?.is_approve) {
        // 用户拒绝执行
        result.extra.terminalStatus = ETS.CANCELED;
        return result;
    }

    // 检查命令是否访问了被 .y3makerignore 忽略的路径
    const accessCheck = checkTerminalCommandAccess(command);
    if (!accessCheck.allowed) {
        result.content =
            `Command blocked: the following paths are restricted by ignore rules and cannot be accessed:\n` +
            accessCheck.blockedPaths
                .map((p) => `  - ${p}`)
                .join('\n') +
            `\n\nPlease avoid accessing these paths. They are excluded by .y3makerignore rules.`;
        result.extra.terminalStatus = ETS.FAILED;
        result.extra.status = ETS.FAILED;
        return result;
    }

    try {
        const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        // 1. 发送初始 START 状态
        sendTerminalLog('', ETS.START, false);

        return new Promise<ExecuteCommandResult>((resolve) => {
            const childProcess = spawn(command, [], {
                cwd: workspace || process.cwd(),
                shell: true,
                stdio: 'pipe',
                detached: true,
                env: {
                    ...process.env,
                    PYTHONIOENCODING: 'utf-8',
                    PYTHONUTF8: '1',
                    NODE_OPTIONS: process.env.NODE_OPTIONS
                        ? `${process.env.NODE_OPTIONS} --no-warnings`
                        : '--no-warnings',
                    LANG: 'C.UTF-8',
                    LC_ALL: 'C.UTF-8',
                    CHCP: '65001',
                },
            });

            let lines: string[] = [];
            let exitCode = 0;
            let hasError = false;

            // 交互式提示检测
            const INTERACTIVE_PROMPT_PATTERNS = [
                /\?\s+.{1,200}\(y\/N\)/i,        // inquirer confirm default No
                /\?\s+.{1,200}\(Y\/n\)/i,        // inquirer confirm default Yes
                /❯\s+.+[\s\S]*?↑↓\s*navigate/,  // inquirer select
                /\]\s*\(y\/N\)/i,                // generic [y/N] at end
                /\]\s*\(Y\/n\)/i,                // generic [Y/n] at end
            ];
            let promptDetectBuffer = '';
            let promptDetectTimer: NodeJS.Timeout | null = null;
            let interactivePromptInfo: { prompt: string; output: string } | null = null;

            // Decode command output as UTF-8 first; Windows localized cmd.exe output
            // may still be GBK/CP936, so fall back when UTF-8 replacement chars appear.
            const decodeBuffer = (data: Buffer): string => {
                const utf8Output = data.toString('utf-8');
                if (process.platform !== 'win32' || !utf8Output.includes('\uFFFD')) {
                    return utf8Output;
                }

                try {
                    return iconv.decode(data, 'gbk');
                } catch {
                    try {
                        return iconv.decode(data, 'gb2312');
                    } catch {
                        return data.toString();
                    }
                }
            };

            // 2. stdout 实时推送
            childProcess.stdout?.on('data', (data: Buffer) => {
                const output = decodeBuffer(data);
                // Filter RTK hook warning noise
                if (isRtk && output.includes('[rtk]') && (output.includes('No hook installed') || output.includes('Hook outdated'))) return;
                lines.push(output);
                sendTerminalLog(output, ETS.RUNNING, true);

                // 交互式提示检测
                if (!interactivePromptInfo) {
                    promptDetectBuffer += output;
                    // 保持滑动窗口 500 字符
                    if (promptDetectBuffer.length > 500) {
                        promptDetectBuffer = promptDetectBuffer.slice(-500);
                    }
                    // 防抖：等 300ms 没有新输出再检测
                    if (promptDetectTimer) { clearTimeout(promptDetectTimer); }
                    promptDetectTimer = setTimeout(() => {
                        const stripped = promptDetectBuffer.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
                        for (const pattern of INTERACTIVE_PROMPT_PATTERNS) {
                            const match = stripped.match(pattern);
                            if (match) {
                                interactivePromptInfo = { prompt: match[0].trim(), output: stripped };
                                console.log(`[Y3Maker] Interactive prompt detected: "${match[0].trim()}"`);
                                // 终止进程（使用进程组 kill）
                                const pid = childProcess.pid;
                                if (pid) {
                                    try {
                                        process.kill(-pid, 'SIGTERM');
                                        setTimeout(() => {
                                            try { process.kill(-pid, 'SIGKILL'); } catch { /* 进程已退出 */ }
                                        }, 500);
                                    } catch {
                                        childProcess.kill('SIGKILL');
                                    }
                                } else {
                                    childProcess.kill('SIGKILL');
                                }
                                break;
                            }
                        }
                    }, 300);
                }
            });

            // 2. stderr 实时推送（stderr 不一定代表错误，很多工具用 stderr 输出进度信息）
            childProcess.stderr?.on('data', (data: Buffer) => {
                const output = decodeBuffer(data);
                lines.push(output);
                sendTerminalLog(output, ETS.RUNNING, true);
            });

            childProcess.on('error', (error: Error) => {
                hasError = true;
                console.error(`[Y3Maker] run_terminal_cmd spawn error:`, error);
            });

            childProcess.on('exit', (code: number | null) => {
                exitCode = code || 0;
                if (exitCode !== 0) {
                    sendTerminalLog(`exit code is ${exitCode}\n`, ETS.SUCCESS, false);
                }
            });

            childProcess.on('close', () => {
                // 清理交互式提示检测计时器
                if (promptDetectTimer) { clearTimeout(promptDetectTimer); promptDetectTimer = null; }

                // 3. 命令执行完毕，发送完成状态的 log
                sendTerminalLog('', ETS.SUCCESS, false);

                const outputText = lines.join('').trim();

                console.log(`[Y3Maker] run_terminal_cmd: exitCode=${exitCode}, hasError=${hasError}, output.len=${outputText.length}`);

                // 对齐源码版：如果状态不是执行失败，默认是执行成功
                if (result.extra.terminalStatus !== ETS.FAILED) {
                    result.extra.terminalStatus = ETS.SUCCESS;
                }

                if (exitCode !== 0 && !outputText.length) {
                    result.content = `Command executed successfully. \n The code of Executed command is ${exitCode}.This output is nothing \n`;
                } else if (interactivePromptInfo) {
                    // 交互式提示被检测到，返回特殊格式让 AI 知道需要向用户询问
                    result.content = `Command was terminated because it requires interactive input.\n`
                        + `Interactive prompt detected: "${interactivePromptInfo.prompt}"\n`
                        + (outputText ? `Output before prompt:\n${outputText}\n\n` : '')
                        + `Please use ask_user_question to ask the user about this decision, then re-run the command with appropriate CLI flags (e.g., -y, --skip-specs) based on their answer.\n`
                        + `Do NOT use stdin pipe (e.g., echo "y" | cmd, yes | cmd) — it breaks TTY detection.\n`;
                } else {
                    result.content = `Command executed successfully.\nOutput: ${outputText}\n`;
                }
                result.isError = hasError;

                resolve(result);
            });

            // 超时保护：防止命令无限挂起
            const timeout = 120000; // 2分钟
            setTimeout(() => {
                if (!childProcess.killed) {
                    const pid = childProcess.pid;
                    if (pid) {
                        try {
                            process.kill(-pid, 'SIGTERM');
                            setTimeout(() => {
                                try { process.kill(-pid, 'SIGKILL'); } catch { /* 进程已退出 */ }
                            }, 500);
                        } catch {
                            childProcess.kill('SIGKILL');
                        }
                    } else {
                        childProcess.kill('SIGKILL');
                    }
                    const outputText = lines.join('').trim();
                    result.content = `Command timed out after ${timeout / 1000}s.\nOutput so far: ${outputText}\n`;
                    result.isError = true;
                    result.extra.terminalStatus = ETS.FAILED;
                    result.extra.status = ETS.FAILED;
                    resolve(result);
                }
            }, timeout);
        });
    } catch (err: any) {
        result.content = `Error running command: ${err.message}`;
        result.isError = true;
        result.extra.terminalStatus = ETS.FAILED;
        result.extra.status = ETS.FAILED;
        return result;
    }
}
