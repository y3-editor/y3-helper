import { TCPClient } from '../tcpClient';

/**
 * 工具定义接口
 */
export interface Tool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}

/**
 * 工具注册表
 * 管理所有可用的 MCP 工具
 */
export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    constructor(private tcpClient: TCPClient) {
        this.registerTools();
    }

    /**
     * 注册所有工具
     */
    private registerTools(): void {
        // 注册 launch_game 工具
        this.tools.set('launch_game', {
            name: 'launch_game',
            description: '启动 Y3 游戏（非阻塞）。调用后立即返回，不会等待游戏完全启动。你必须随后每10s使用 get_game_status 轮询(无次数上限)，直到 status 变为 "running"。如果游戏已在运行，会直接返回当前状态。',
            inputSchema: {
                type: 'object',
                properties: {}
            }
        });

        // 注册 get_logs 工具
        this.tools.set('get_logs', {
            name: 'get_logs',
            description: '获取游戏控制台日志。返回最近的日志内容。',
            inputSchema: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'number',
                        description: '返回最近 N 条日志，默认 100',
                        default: 100
                    }
                }
            }
        });

        // 注册 execute_lua 工具
        this.tools.set('execute_lua', {
            name: 'execute_lua',
            description: '在运行的游戏中执行 Lua 代码。代码会在游戏的 Lua 环境中执行，可以访问游戏 API。',
            inputSchema: {
                type: 'object',
                properties: {
                    code: {
                        type: 'string',
                        description: '要执行的 Lua 代码'
                    }
                },
                required: ['code']
            }
        });

        // 注册 stop_game 工具
        this.tools.set('stop_game', {
            name: 'stop_game',
            description: '停止当前运行的游戏会话。',
            inputSchema: {
                type: 'object',
                properties: {}
            }
        });

        // 注册 get_game_status 工具
        this.tools.set('get_game_status', {
            name: 'get_game_status',
            description: '获取游戏运行状态，包括是否运行、会话 ID、运行时长等信息。',
            inputSchema: {
                type: 'object',
                properties: {}
            }
        });

        // 注册 quick_restart 工具
        this.tools.set('quick_restart', {
            name: 'quick_restart',
            description: '快速重启游戏（.rr 命令）。重新加载所有 Lua 脚本，无需完全重启游戏进程。适用于代码修改后快速测试。',
            inputSchema: {
                type: 'object',
                properties: {}
            }
        });

        // 注册 capture_screenshot 工具
        this.tools.set('capture_screenshot', {
            name: 'capture_screenshot',
            description: '捕获当前游戏画面的截图。前置条件：游戏必须处于运行状态（先调用 get_game_status 确认）。用于验证 UI 显示效果、调试界面问题、记录游戏状态或生成文档。截图使用客户端当前分辨率，自动保存到编辑器安装路径下的 LocalData/mcp_screenshots/screenshot.png。成功时返回截图文件的绝对路径，失败时返回明确的错误原因和解决建议。常见使用场景：启动游戏后验证界面、执行 Lua 代码后查看效果、调试 UI 布局问题、记录错误发生时的画面。',
            inputSchema: {
                type: 'object',
                properties: {}
            }
        });
    }

    /**
     * 列出所有工具
     */
    listTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * 调用工具
     */
    async callTool(name: string, args: any): Promise<any> {
        if (!this.tools.has(name)) {
            throw new Error(`Unknown tool: ${name}`);
        }

        // 通过 TCP 调用扩展的方法
        const result = await this.tcpClient.call(name, args);
        return result;
    }
}
