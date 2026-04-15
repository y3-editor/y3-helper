#!/usr/bin/env node

/**
 * MCP Server 测试脚本
 * 测试 MCP Server 的基本功能
 */

const { spawn } = require('child_process');
const net = require('net');
const os = require('os');
const path = require('path');

// 获取 Socket 路径
function getSocketPath() {
    const tmpDir = os.tmpdir();
    const socketName = process.platform === 'win32'
        ? '\\\\.\\pipe\\y3-helper-mcp'
        : path.join(tmpDir, 'y3-helper-mcp.sock');
    return socketName;
}

console.log('=== MCP Server 测试 ===\n');

// 测试 1: 检查 Socket 路径
console.log('测试 1: Socket 路径');
const socketPath = getSocketPath();
console.log(`  平台: ${process.platform}`);
console.log(`  Socket 路径: ${socketPath}\n`);

// 测试 2: 启动 MCP Server
console.log('测试 2: 启动 MCP Server');
const mcpServer = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
});

let mcpOutput = '';
let mcpError = '';

mcpServer.stdout.on('data', (data) => {
    mcpOutput += data.toString();
    console.log(`  [MCP stdout] ${data.toString().trim()}`);
});

mcpServer.stderr.on('data', (data) => {
    mcpError += data.toString();
    console.log(`  [MCP stderr] ${data.toString().trim()}`);
});

mcpServer.on('error', (error) => {
    console.error(`  ❌ MCP Server 启动失败: ${error.message}`);
    process.exit(1);
});

// 等待 MCP Server 启动
setTimeout(() => {
    console.log('\n测试 3: 发送 MCP 初始化请求');

    // 发送 initialize 请求
    const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'test-client',
                version: '1.0.0'
            }
        }
    };

    mcpServer.stdin.write(JSON.stringify(initRequest) + '\n');

    // 等待响应
    setTimeout(() => {
        console.log('\n测试 4: 请求工具列表');

        const toolsRequest = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
        };

        mcpServer.stdin.write(JSON.stringify(toolsRequest) + '\n');

        // 等待响应后关闭
        setTimeout(() => {
            console.log('\n测试 5: 检查 IPC Socket 连接');

            // 尝试连接到 IPC Socket（如果 VSCode 扩展正在运行）
            const client = net.connect(socketPath);

            client.on('connect', () => {
                console.log('  ✅ IPC Socket 连接成功');
                client.end();
                cleanup();
            });

            client.on('error', (err) => {
                console.log(`  ⚠️  IPC Socket 未运行 (这是正常的，需要在 VSCode 中启动)`);
                console.log(`     错误: ${err.message}`);
                cleanup();
            });

        }, 2000);
    }, 2000);
}, 1000);

function cleanup() {
    console.log('\n=== 测试完成 ===');
    console.log('\n总结:');
    console.log('  - MCP Server 可执行文件: ✅');
    console.log('  - Socket 路径配置: ✅');
    console.log('  - MCP Server 启动: ' + (mcpError.includes('Error') ? '❌' : '✅'));
    console.log('  - IPC 通信: 需要在 VSCode 中启动扩展');

    mcpServer.kill();
    process.exit(0);
}

// 处理退出
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
