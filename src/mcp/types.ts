import * as os from 'os';
import * as path from 'path';
import type { GameLauncher } from '../launchGame';
import type { Client } from '../console/client';
import type { LogManager } from './logManager';

/**
 * 获取 TCP 连接配置
 * 使用 TCP Socket 以避免权限问题（管理员进程 ↔ 普通用户进程）
 */
export function getTCPConfig(): { host: string; port: number } {
    return {
        host: '127.0.0.1',
        port: 25897  // Y3-Helper MCP 内部通信端口
    };
}

/**
 * 获取 IPC Socket 路径（已废弃，保留用于兼容）
 * @deprecated 使用 getTCPConfig() 代替
 */
export function getSocketPath(): string {
    const config = getTCPConfig();
    return `${config.host}:${config.port}`;
}

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
 * MCP 错误类
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
 * TCP 请求格式
 */
export interface TCPRequest {
    id: string;
    method: string;
    params?: any;
}

/**
 * TCP 响应格式
 */
export interface TCPResponse {
    id: string;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
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
