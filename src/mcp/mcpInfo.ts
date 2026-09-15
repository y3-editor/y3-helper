export const MCP_HTTP_PORT = 8766;
export const MCP_ENDPOINT = `http://127.0.0.1:${MCP_HTTP_PORT}/mcp`;

const FENCE = '```';

export const MCP_INSTRUCTIONS = `Y3-Helper MCP server: control the Y3 game editor project opened in VS Code.

The server only listens on ${MCP_ENDPOINT} while VS Code is running on an initialized Y3 project. Game tools return an error when no game is running.

Typical workflow:
1. launch_game to start the game, then get_game_status to confirm a client is attached.
2. execute_lua to inspect or change runtime state. Keep snippets small and read the returned value.
3. After editing Lua files, quick_restart to reload game code instead of relaunching.
4. get_logs and read_problems_lua to diagnose failures.
5. When several game windows run, take clientSlot from get_game_status to target a specific one.`;

const TOOL_TABLE = [
    '| 工具 | 说明 |',
    '| --- | --- |',
    '| `launch_game` | 启动游戏并附加调试器 |',
    '| `get_game_status` | 查询游戏与已连接客户端的运行状态 |',
    '| `execute_lua` | 在运行中的游戏里执行 Lua 代码 |',
    '| `quick_restart` | 快速重启游戏会话，用于让 Lua 改动生效 |',
    '| `stop_game` | 停止游戏会话 |',
    '| `get_logs` | 读取最近的游戏日志 |',
    '| `capture_screenshot` | 截取游戏画面 |',
    '| `read_problems_lua` | 获取工程内 Lua 文件的静态检查诊断 |',
    '| `get_ui_canvas` | 导出当前地图的 UI 画布树 |',
].join('\n');

const Y3MAKER_CONFIG = JSON.stringify({
    mcpServers: {
        'y3-helper': {
            type: 'streamableHttp',
            url: MCP_ENDPOINT,
            headers: {},
            timeout: 60,
            autoApprove: true,
            disabled: false,
        },
    },
}, null, 2);

const CLAUDE_CODE_CONFIG = JSON.stringify({
    mcpServers: {
        'y3-helper': {
            type: 'http',
            url: MCP_ENDPOINT,
        },
    },
}, null, 2);

export const MCP_DOC = `# Y3-Helper MCP 接入说明

请按本文档为本机完成 MCP 接入配置，然后重启对应的 AI 工具使其生效。

## 服务信息

- 传输方式：Streamable HTTP
- 地址：${MCP_ENDPOINT}
- 前置条件：用 VS Code 打开已初始化的 Y3 工程，且 Y3 开发助手扩展已激活
- 启动方式：扩展激活后自动启动；也可在命令面板执行 \`y3-helper.startMCPServer\` / \`y3-helper.stopMCPServer\`
- 仅本机可访问（127.0.0.1），VS Code 关闭后服务停止

## 客户端配置

### VS Code 内置 AI

VS Code 1.102 及以上无需配置：Y3 开发助手已注册 MCP Server Definition Provider，内置 AI（Copilot Chat 等）会自动发现 \`y3-helper\` 服务。

### Y3Maker

项目根目录 \`.y3maker/mcp_settings.json\`：

${FENCE}json
${Y3MAKER_CONFIG}
${FENCE}

初始化过的工程通常已自带该配置，无需手动添加。

### Claude Code

在项目根目录创建 \`.mcp.json\`：

${FENCE}json
${CLAUDE_CODE_CONFIG}
${FENCE}

或执行：

${FENCE}bash
claude mcp add --transport http y3-helper ${MCP_ENDPOINT}
${FENCE}

### Codex

在 \`~/.codex/config.toml\`（或项目级 \`.codex/config.toml\`）中追加：

${FENCE}toml
[mcp_servers.y3-helper]
url = "${MCP_ENDPOINT}"
${FENCE}

或执行：

${FENCE}bash
codex mcp add y3-helper --url ${MCP_ENDPOINT}
${FENCE}

## 可用工具

${TOOL_TABLE}

## 典型工作流

1. \`launch_game\` 启动游戏，再用 \`get_game_status\` 确认客户端已连接
2. \`execute_lua\` 读取或修改游戏运行时状态
3. 修改工程内 Lua 代码后，\`quick_restart\` 重载游戏代码
4. 出错时用 \`get_logs\`、\`read_problems_lua\` 定位问题
5. 同时运行多个游戏窗口时，从 \`get_game_status\` 的 \`clients\` 中取 \`clientSlot\` 指定目标窗口
`;

