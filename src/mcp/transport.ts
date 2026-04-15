import * as readline from 'readline';
import { MCPProtocol } from './protocol';

/**
 * Stdio 传输层
 * 处理 stdin/stdout 通信
 */
export class StdioTransport {
    private rl?: readline.Interface;

    constructor(private protocol: MCPProtocol) {}

    /**
     * 启动传输层
     */
    async start(): Promise<void> {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false
        });

        this.rl.on('line', async (line) => {
            try {
                const request = JSON.parse(line);
                const response = await this.protocol.handleRequest(request);
                this.send(response);
            } catch (err) {
                console.error('[MCP] Failed to handle request:', err);
                this.send({
                    jsonrpc: '2.0',
                    id: null,
                    error: {
                        code: -32700,
                        message: 'Parse error'
                    }
                });
            }
        });

        this.rl.on('close', () => {
            console.error('[MCP] Stdin closed, exiting...');
            process.exit(0);
        });
    }

    /**
     * 发送响应
     */
    private send(message: any): void {
        // 使用 stdout 发送响应
        console.log(JSON.stringify(message));
    }
}
