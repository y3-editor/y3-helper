import * as net from 'net';
import { getTCPConfig, TCPRequest, TCPResponse } from './types';

/**
 * TCP 客户端（子进程侧）
 * 连接到扩展的 TCP 服务器，发送请求并接收响应
 */
export class TCPClient {
    private socket?: net.Socket;
    private buffer: string = '';
    private pendingRequests: Map<string, {
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }> = new Map();
    private requestId: number = 0;

    /**
     * 连接到 TCP 服务器
     */
    async connect(): Promise<void> {
        const config = getTCPConfig();

        return new Promise((resolve, reject) => {
            this.socket = net.createConnection(config.port, config.host, () => {
                console.error('[MCP] Connected to TCP server');
                resolve();
            });

            this.socket.on('error', (err) => {
                console.error('[MCP] TCP connection error:', err);
                reject(err);
            });

            this.socket.on('data', (data) => {
                this.handleData(data as Buffer);
            });

            this.socket.on('close', () => {
                console.error('[MCP] TCP connection closed');
                // 拒绝所有待处理的请求
                this.pendingRequests.forEach(({ reject }) => {
                    reject(new Error('Connection closed'));
                });
                this.pendingRequests.clear();
            });
        });
    }

    /**
     * 处理接收到的数据
     */
    private handleData(data: Buffer): void {
        this.buffer += data.toString();

        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const response = JSON.parse(line) as TCPResponse;
                    this.handleResponse(response);
                } catch (err) {
                    console.error('[MCP] Failed to parse TCP response:', err);
                }
            }
        }
    }

    /**
     * 处理响应
     */
    private handleResponse(response: TCPResponse): void {
        const { id, result, error } = response;
        const pending = this.pendingRequests.get(id);

        if (pending) {
            this.pendingRequests.delete(id);
            if (error) {
                pending.reject(new Error(error.message));
            } else {
                pending.resolve(result);
            }
        }
    }

    /**
     * 调用 TCP 方法
     */
    async call(method: string, params?: any): Promise<any> {
        if (!this.socket) {
            throw new Error('Not connected to TCP server');
        }

        const id = String(++this.requestId);
        const request: TCPRequest = { id, method, params };

        return new Promise((resolve, reject) => {
            // 设置超时（30 秒）
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }, 30000);  // 30 秒超时

            // 保存请求处理器
            this.pendingRequests.set(id, {
                resolve: (value) => {
                    clearTimeout(timeout);
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            // 发送请求
            this.socket!.write(JSON.stringify(request) + '\n', (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(id);
                    reject(err);
                }
            });
        });
    }

    /**
     * 断开连接
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.destroy();
            this.socket = undefined;
        }
    }
}
