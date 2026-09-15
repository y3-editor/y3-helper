// 扩展宿主与提权代理之间的管道协议定义，两端共用（代理侧不得依赖 vscode）

/** 请求启动一个进程 */
export interface LaunchRequest {
    type: 'launch';
    id: number;
    exe: string;
    args: string[];
    cwd?: string;
}

/** 保活探测 */
export interface PingRequest {
    type: 'ping';
}

/** 请求终止代理启动过的进程 */
export interface KillRequest {
    type: 'kill';
    id: number;
}

/** 请求代理退出 */
export interface ShutdownRequest {
    type: 'shutdown';
}

export type AgentRequest = LaunchRequest | PingRequest | KillRequest | ShutdownRequest;

/** 代理握手，携带凭据供扩展宿主校验 */
export interface ReadyMessage {
    type: 'ready';
    token: string;
}

/** 进程创建成功 */
export interface LaunchedMessage {
    type: 'launched';
    id: number;
    pid: number;
}

/** 进程退出 */
export interface ExitMessage {
    type: 'exit';
    id: number;
    code: number | null;
}

/** 终止请求的处理结果，count 为已终止的进程数 */
export interface KilledMessage {
    type: 'killed';
    id: number;
    count: number;
}

/** 请求被拒绝或启动失败 */
export interface ErrorMessage {
    type: 'error';
    id?: number;
    message: string;
}

export interface PongMessage {
    type: 'pong';
}

export type AgentMessage = ReadyMessage | LaunchedMessage | ExitMessage | KilledMessage | ErrorMessage | PongMessage;

export function encodeMessage(message: AgentRequest | AgentMessage): string {
    return JSON.stringify(message) + '\n';
}

/** 以换行符分帧的 JSON Lines 解码器 */
export class LineDecoder {
    private buffer: string = '';

    constructor(
        private onMessage: (message: any) => void,
        private onError?: (error: Error) => void,
    ) {
    }

    public push(chunk: string) {
        this.buffer += chunk;
        let index = this.buffer.indexOf('\n');
        while (index >= 0) {
            let line = this.buffer.slice(0, index).trim();
            this.buffer = this.buffer.slice(index + 1);
            if (line) {
                try {
                    this.onMessage(JSON.parse(line));
                } catch (error) {
                    this.onError?.(error as Error);
                }
            }
            index = this.buffer.indexOf('\n');
        }
    }
}
