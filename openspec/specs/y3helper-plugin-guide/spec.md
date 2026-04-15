# Y3Helper 插件开发指南

本文档指导如何在 Y3Helper 中开发新的插件功能模块。

## 快速开始

用 5 分钟创建一个最小的 TreeView 节点。

### Step 1: 创建页面文件

在 `src/mainMenu/pages/` 目录下创建新文件，例如 `aiAssistant.ts`：

```typescript
import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';

export class AI助手 extends TreeNode {
    constructor() {
        super(l10n.t('AI助手'), {
            iconPath: new vscode.ThemeIcon('hubot'),
            command: {
                command: 'y3-helper.aiAssistant.hello',
                title: l10n.t('AI助手'),
            },
        });
    }
}

// 注册命令
vscode.commands.registerCommand('y3-helper.aiAssistant.hello', () => {
    vscode.window.showInformationMessage('Hello from AI助手!');
});
```

### Step 2: 在主菜单中注册

打开 `src/mainMenu/mainMenu.ts`，添加导入和节点：

```typescript
// 在文件顶部添加导入
import { AI助手 } from './pages/aiAssistant';

// 在 makeMainNode() 函数的 childs 数组中添加
function makeMainNode() {
    return new TreeNode(l10n.t('主菜单'), {
        childs: [
            new 功能,
            new 地图管理,
            new 插件列表,
            new AI助手,  // ← 添加这一行
            // ... 其他节点
        ]
    });
}
```

### Step 3: 在 package.json 中声明命令

打开 `package.json`，在 `contributes.commands` 数组中添加：

```json
{
    "command": "y3-helper.aiAssistant.hello",
    "title": "AI助手 - Hello"
}
```

### Step 4: 编译并测试

```bash
npm run compile
```

按 `F5` 启动调试，在 Y3Helper 侧边栏应该能看到「AI助手」节点。点击后会弹出提示消息。

---

## TreeNode 使用指南

`TreeNode` 是 Y3Helper 所有菜单节点的基类，继承自 `vscode.TreeItem`。

### 可配置属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `command` | `Command` | 点击节点时执行的命令 |
| `iconPath` | `ThemeIcon \| Uri` | 节点图标 |
| `childs` | `TreeNode[]` | 子节点列表 |
| `show` | `boolean \| Function` | 是否显示（可动态判断） |
| `update` | `Function` | 节点更新时的回调 |
| `init` | `Function` | 节点初始化时的回调（只执行一次） |
| `description` | `string` | 节点描述（显示在标签右侧） |
| `tooltip` | `string` | 鼠标悬停提示 |
| `contextValue` | `string` | 用于右键菜单过滤 |
| `checkboxState` | `TreeItemCheckboxState` | 复选框状态 |

### 示例：带子节点的分组

```typescript
export class 我的功能组 extends TreeNode {
    constructor() {
        super(l10n.t('我的功能'), {
            iconPath: new vscode.ThemeIcon('folder'),
            childs: [
                new TreeNode(l10n.t('子功能1'), {
                    iconPath: new vscode.ThemeIcon('file'),
                    command: { command: 'y3-helper.func1', title: '子功能1' },
                }),
                new TreeNode(l10n.t('子功能2'), {
                    iconPath: new vscode.ThemeIcon('file'),
                    command: { command: 'y3-helper.func2', title: '子功能2' },
                }),
            ],
        });
    }
}
```

### 示例：动态显示/隐藏

```typescript
export class 条件功能 extends TreeNode {
    constructor() {
        super(l10n.t('条件功能'), {
            iconPath: new vscode.ThemeIcon('eye'),
            // 只有在地图加载后才显示
            show: async () => {
                await y3.env.mapReady();
                return y3.env.mapUri !== undefined;
            },
        });
    }
}
```

### 示例：动态更新内容

```typescript
export class 动态列表 extends TreeNode {
    constructor() {
        super(l10n.t('动态列表'), {
            iconPath: new vscode.ThemeIcon('list-unordered'),
            update: async (node) => {
                // 每次展开时重新获取子节点
                const items = await fetchItems();
                node.childs = items.map(item => 
                    new TreeNode(item.name, {
                        command: { command: 'y3-helper.openItem', title: item.name, arguments: [item] },
                    })
                );
            },
        });
    }
}
```

---

## 命令注册指南

### 基本命令注册

```typescript
import * as vscode from 'vscode';

// 注册命令
vscode.commands.registerCommand('y3-helper.myCommand', (arg1, arg2) => {
    console.log('命令被执行', arg1, arg2);
});
```

### 在 package.json 中声明

```json
{
    "contributes": {
        "commands": [
            {
                "command": "y3-helper.myCommand",
                "title": "我的命令",
                "icon": "$(play)"
            }
        ]
    }
}
```

### 命令与 TreeNode 绑定

```typescript
new TreeNode(l10n.t('执行操作'), {
    command: {
        command: 'y3-helper.myCommand',
        title: l10n.t('执行操作'),
        arguments: ['参数1', '参数2'],  // 可选：传递参数
    },
});
```

---

## WebView 开发指南

WebView 用于展示复杂的自定义 UI。

### 创建 WebView 面板

```typescript
import * as vscode from 'vscode';

function openWebViewPanel() {
    const panel = vscode.window.createWebviewPanel(
        'aiAssistant',           // viewType: 面板类型标识
        'AI助手',                // title: 面板标题
        vscode.ViewColumn.One,   // 显示位置
        {
            enableScripts: true,              // 允许运行 JavaScript
            retainContextWhenHidden: true,    // 隐藏时保持状态
        }
    );

    // 设置 HTML 内容
    panel.webview.html = getWebviewContent();

    // 监听来自 WebView 的消息
    panel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'alert':
                vscode.window.showInformationMessage(message.text);
                break;
        }
    });

    return panel;
}

function getWebviewContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { padding: 20px; font-family: sans-serif; }
        button { padding: 10px 20px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>AI助手</h1>
    <button id="btn">点击发送消息</button>
    <script>
        const vscode = acquireVsCodeApi();
        document.getElementById('btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'alert', text: 'Hello from WebView!' });
        });
    </script>
</body>
</html>`;
}
```

### 扩展向 WebView 发送消息

```typescript
panel.webview.postMessage({ command: 'update', data: someData });
```

### WebView 中接收消息

```html
<script>
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'update') {
            // 处理数据更新
            console.log(message.data);
        }
    });
</script>
```

---

## 完整示例：AI助手插件

以下是一个完整的 AI助手插件示例，包含 TreeNode、命令和 WebView。

### 文件：`src/mainMenu/pages/aiAssistant.ts`

```typescript
import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';

let panel: vscode.WebviewPanel | undefined;

export class AI助手 extends TreeNode {
    constructor() {
        super(l10n.t('AI助手'), {
            iconPath: new vscode.ThemeIcon('hubot'),
            command: {
                command: 'y3-helper.aiAssistant.open',
                title: l10n.t('打开AI助手'),
            },
        });
    }
}

// 注册打开命令
vscode.commands.registerCommand('y3-helper.aiAssistant.open', () => {
    if (panel) {
        panel.reveal();
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'aiAssistant',
        'AI助手',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
        }
    );

    panel.webview.html = getWebviewContent();

    panel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'sendMessage':
                // 处理用户发送的消息
                vscode.window.showInformationMessage(`收到消息: ${message.text}`);
                break;
        }
    });

    panel.onDidDispose(() => {
        panel = undefined;
    });
});

function getWebviewContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { padding: 20px; font-family: sans-serif; }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { color: #007acc; }
        .input-group { display: flex; gap: 10px; margin-top: 20px; }
        input { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
        button { padding: 10px 20px; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #005a9e; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 AI助手</h1>
        <p>这是一个示例 WebView 面板。</p>
        <div class="input-group">
            <input type="text" id="input" placeholder="输入消息..." />
            <button id="sendBtn">发送</button>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('sendBtn');
        
        sendBtn.addEventListener('click', () => {
            const text = input.value.trim();
            if (text) {
                vscode.postMessage({ command: 'sendMessage', text });
                input.value = '';
            }
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendBtn.click();
        });
    </script>
</body>
</html>`;
}
```

---

## 文件组织规范

### 目录结构

```
src/
├── mainMenu/
│   ├── index.ts          # 导出模块
│   ├── mainMenu.ts       # 主菜单组装
│   ├── treeNode.ts       # TreeNode 基类
│   └── pages/            # 各功能页面
│       ├── features.ts
│       ├── plugin.ts
│       ├── aiAssistant.ts  # ← 新插件放这里
│       └── ...
```

### 添加新插件的步骤

1. **创建页面文件**: `src/mainMenu/pages/<name>.ts`
2. **导出类**: 在文件中 `export class Xxx extends TreeNode`
3. **注册命令**: 在同一文件中调用 `vscode.commands.registerCommand`
4. **添加到主菜单**: 在 `mainMenu.ts` 的 `makeMainNode()` 中添加
5. **声明命令**: 在 `package.json` 的 `contributes.commands` 中添加

### 命名规范

| 项目 | 规范 | 示例 |
|------|------|------|
| 文件名 | camelCase | `aiAssistant.ts` |
| 类名 | 中文或 PascalCase | `AI助手` 或 `AIAssistant` |
| 命令 ID | `y3-helper.<module>.<action>` | `y3-helper.aiAssistant.open` |
| 图标 | VSCode 内置图标 | `$(hubot)`, `$(play)`, `$(file)` |

### 常用 VSCode 图标

- `hubot` - 机器人
- `play` - 播放
- `file` - 文件
- `folder` - 文件夹
- `gear` - 设置
- `extensions` - 插件
- `search` - 搜索
- `sync` - 同步
- `cloud-download` - 下载
- `list-tree` - 树形列表

完整图标列表：https://code.visualstudio.com/api/references/icons-in-labels
