import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * 检测 WSL 是否可用
 */
export async function isWSLAvailable(): Promise<boolean> {
    if (os.platform() !== 'win32') {
        return false;
    }

    try {
        const result = await execPromise('wsl.exe --list --quiet', { timeout: 5000 });
        return result.stdout.trim().length > 0;
    } catch {
        return false;
    }
}

/**
 * 检测 Claude CLI 是否在 WSL 中安装
 */
export async function isClaudeInstalled(): Promise<boolean> {
    try {
        await execPromise('wsl.exe bash -lic "command -v claude"', { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

/**
 * 检测 Claude CLI 是否在 Windows 中安装
 */
export async function isClaudeInstalledWindows(): Promise<boolean> {
    try {
        await execPromise('claude --version', { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

/**
 * 将 Windows 路径转换为 WSL 路径
 * @param windowsPath Windows 路径 (例如: C:\Users\BAIM\...)
 * @returns WSL 路径 (例如: /mnt/c/Users/BAIM/...)
 */
export function convertToWSLPath(windowsPath: string): string {
    const normalized = windowsPath.replace(/\\/g, '/');
    const match = normalized.match(/^([A-Z]):(.*)/i);
    if (match) {
        const drive = match[1].toLowerCase();
        const path = match[2];
        return `/mnt/${drive}${path}`;
    }
    return normalized;
}

/**
 * 将 WSL 路径转换为 Windows 路径
 * @param wslPath WSL 路径 (例如: /mnt/c/Users/BAIM/...)
 * @returns Windows 路径 (例如: C:\Users\BAIM\...)
 */
export function convertToWindowsPath(wslPath: string): string {
    const match = wslPath.match(/^\/mnt\/([a-z])(.*)/i);
    if (match) {
        const drive = match[1].toUpperCase();
        const path = match[2].replace(/\//g, '\\');
        return `${drive}:${path}`;
    }
    return wslPath;
}

/**
 * 在 Windows 中配置 MCP
 * @param mcpServerPath mcp-server.js 的 Windows 路径
 * @returns 配置结果
 */
export async function configureMCPInWindows(mcpServerPath: string): Promise<{ success: boolean; message: string }> {
    // Windows 路径需要转义反斜杠
    const escapedPath = mcpServerPath.replace(/\\/g, '\\\\');

    try {
        // 检查文件是否存在
        const fs = require('fs');
        if (!fs.existsSync(mcpServerPath)) {
            return {
                success: false,
                message: `ERROR: mcp-server.js not found at ${mcpServerPath}`
            };
        }

        // 删除旧配置（忽略错误）
        try {
            await execPromise('claude mcp remove y3-helper', { timeout: 10000 });
        } catch {
            // 忽略删除失败的错误
        }

        // 添加新配置
        const addCommand = `claude mcp add -s user y3-helper -- node "${mcpServerPath}"`;
        await execPromise(addCommand, { timeout: 10000 });

        // 配置成功，返回使用说明
        return {
            success: true,
            message: `SUCCESS: MCP configured successfully\n\n使用步骤：\n1. 在 VSCode 侧边栏点击"启动 MCP Server"\n2. 在命令行中启动 claude\n3. 输入 /mcp 检查连接状态`
        };
    } catch (error: any) {
        const errorMessage = error.stdout || error.stderr || error.message || '未知错误';
        return {
            success: false,
            message: `ERROR: Failed to configure MCP\n${errorMessage}`
        };
    }
}

/**
 * 在 WSL 中配置 MCP
 * @param mcpServerPath mcp-server.js 的 Windows 路径
 * @returns 配置结果
 */
export async function configureMCPInWSL(mcpServerPath: string): Promise<{ success: boolean; message: string }> {
    const wslPath = convertToWSLPath(mcpServerPath);

    try {
        // 1. 检查文件是否存在
        const checkFileCmd = `wsl.exe bash -lic "test -f '${wslPath}' && echo 'exists' || echo 'not found'"`;
        const checkResult = await execPromise(checkFileCmd, { timeout: 5000 });

        if (checkResult.stdout.trim() !== 'exists') {
            return {
                success: false,
                message: `ERROR: mcp-server.js not found at ${wslPath}`
            };
        }

        // 2. 检查 node.exe 是否可用
        try {
            await execPromise('wsl.exe bash -lic "command -v node.exe"', { timeout: 5000 });
        } catch {
            return {
                success: false,
                message: 'ERROR: node.exe not found in WSL. Please ensure Windows Node.js is accessible from WSL.'
            };
        }

        // 3. 删除旧配置（忽略错误）
        try {
            await execPromise('wsl.exe bash -lic "claude mcp remove y3-helper 2>/dev/null"', { timeout: 10000 });
        } catch {
            // 忽略删除失败的错误
        }

        // 4. 添加新配置（使用 node.exe 和 Windows 路径）
        // 注意：在 WSL 中配置时，使用 Windows 的 node.exe 和 Windows 路径格式
        const windowsPath = convertToWindowsPath(wslPath);
        const addCmd = `wsl.exe bash -lic "claude mcp add -s user y3-helper node.exe '${windowsPath}'"`;
        await execPromise(addCmd, { timeout: 10000 });

        // 5. 配置成功，返回使用说明
        return {
            success: true,
            message: `SUCCESS: MCP configured successfully\nUsing: node.exe\nScript: ${windowsPath}\n\n使用步骤：\n1. 在 VSCode 侧边栏点击"启动 MCP Server"\n2. 在 WSL 终端中启动 claude\n3. 输入 /mcp 检查连接状态`
        };
    } catch (error: any) {
        const errorMessage = error.stdout || error.stderr || error.message || '未知错误';
        return {
            success: false,
            message: `ERROR: Failed to configure MCP\n${errorMessage}`
        };
    }
}
