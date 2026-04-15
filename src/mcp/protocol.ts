import { ToolRegistry } from './tools';

/**
 * MCP 协议处理器
 * 处理 JSON-RPC 2.0 协议
 */
export class MCPProtocol {
    private serverInfo = {
        name: 'y3-helper',
        version: '1.0.0'
    };

    constructor(private toolRegistry: ToolRegistry) {}

    /**
     * 处理 MCP 请求
     */
    async handleRequest(request: any): Promise<any> {
        const { jsonrpc, id, method, params } = request;

        if (jsonrpc !== '2.0') {
            return this.errorResponse(id, -32600, 'Invalid Request');
        }

        try {
            let result;

            switch (method) {
                case 'initialize':
                    result = await this.handleInitialize(params);
                    break;

                case 'tools/list':
                    result = await this.handleToolsList();
                    break;

                case 'tools/call':
                    result = await this.handleToolsCall(params);
                    break;

                default:
                    return this.errorResponse(id, -32601, `Method not found: ${method}`);
            }

            return {
                jsonrpc: '2.0',
                id,
                result
            };

        } catch (error) {
            return this.errorResponse(
                id,
                -32603,
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    /**
     * 处理 initialize 请求
     */
    private async handleInitialize(params: any): Promise<any> {
        return {
            protocolVersion: '2024-11-05',
            serverInfo: this.serverInfo,
            capabilities: {
                tools: {}
            }
        };
    }

    /**
     * 处理 tools/list 请求
     */
    private async handleToolsList(): Promise<any> {
        const tools = this.toolRegistry.listTools();
        return { tools };
    }

    /**
     * 处理 tools/call 请求
     */
    private async handleToolsCall(params: any): Promise<any> {
        const { name, arguments: args } = params;

        if (!name) {
            throw new Error('Tool name is required');
        }

        const result = await this.toolRegistry.callTool(name, args || {});

        // 将结果包装为 MCP 格式
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    }

    /**
     * 生成错误响应
     */
    private errorResponse(id: any, code: number, message: string): any {
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code,
                message
            }
        };
    }
}
