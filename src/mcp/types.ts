import type { GameLauncher } from '../launchGame';
import type { Client } from '../console/client';
import type { LogManager } from './logManager';

/**
 * MCP 错误码
 */
export enum MCPErrorCode {
    // JSON-RPC 标准错误码
    PARSE_ERROR = -32700,
    INVALID_REQUEST = -32600,
    METHOD_NOT_FOUND = -32601,
    INVALID_PARAMS = -32602,
    INTERNAL_ERROR = -32603,

    // Y3-Helper 自定义错误码
    GAME_NOT_RUNNING = -32001,
    GAME_LAUNCH_FAILED = -32002,
    LUA_EXECUTION_FAILED = -32003,
    SESSION_NOT_FOUND = -32004,
    IPC_CONNECTION_FAILED = -32005,
    CLIENT_NOT_CONNECTED = -32006,
}

/**
 * MCP 错误类型
 */
export class MCPError extends Error {
    constructor(
        message: string,
        public code: number = MCPErrorCode.INTERNAL_ERROR,
        public data?: any
    ) {
        super(message);
        this.name = 'MCPError';
    }
}

/**
 * 游戏会话接口
 */
export interface GameSession {
    id: string;
    launcher: GameLauncher;
    client?: Client;
    logManager: LogManager;
    status: 'launching' | 'running' | 'stopped' | 'restarting';
    startTime: number;
    errorMessage?: string;
}
