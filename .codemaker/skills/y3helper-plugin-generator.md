---
name: y3helper-plugin-generator
description: 为 Y3Helper 创建新的插件功能模块。当用户请求「创建 Y3Helper 插件」、「新增 Y3Helper 功能」、「添加 Y3Helper 菜单项」时触发此 Skill。
---

# Y3Helper 插件生成器

为 Y3Helper VSCode 扩展自动生成新插件的脚手架代码。

## 触发条件

当用户请求以下内容时激活此 Skill：
- 「创建 Y3Helper 插件」
- 「新增 Y3Helper 功能模块」
- 「添加 Y3Helper 菜单项」
- 「在 Y3Helper 中添加新功能」

## 工作流程

### Step 1: 收集插件信息

使用 `ask_user_question` 工具依次收集以下信息：

**1.1 插件中文名称**（用于菜单显示）
```
请输入插件的中文名称（将显示在 Y3Helper 侧边栏）
```

**1.2 插件英文标识**（用于代码命名）
```
请输入插件的英文标识（camelCase，用于文件名和命令ID）
示例：aiAssistant, dataExporter, configEditor
```

**1.3 功能类型**
```
请选择插件的功能类型：
- 简单命令：点击后执行一个操作（如弹出提示、打开文件）
- WebView 面板：点击后打开一个自定义 UI 窗口
- 功能分组：包含多个子功能的菜单组
```

**1.4 图标选择**
```
请选择插件图标（VSCode 内置图标）：
- hubot (机器人)
- play (播放)
- gear (设置)
- extensions (插件)
- file (文件)
- folder (文件夹)
- search (搜索)
- 其他（请输入图标名称）
```

### Step 2: 生成代码

根据收集的信息，生成以下文件：

#### 2.1 页面文件模板

**文件路径**: `src/mainMenu/pages/{英文标识}.ts`

**简单命令类型**:
```typescript
import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';

export class {中文名称} extends TreeNode {
    constructor() {
        super(l10n.t('{中文名称}'), {
            iconPath: new vscode.ThemeIcon('{图标}'),
            command: {
                command: 'y3-helper.{英文标识}.execute',
                title: l10n.t('{中文名称}'),
            },
        });
    }
}

// 注册命令
vscode.commands.registerCommand('y3-helper.{英文标识}.execute', () => {
    // TODO: 实现命令逻辑
    vscode.window.showInformationMessage('Hello from {中文名称}!');
});
```

**WebView 面板类型**:
```typescript
import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';

let panel: vscode.WebviewPanel | undefined;

export class {中文名称} extends TreeNode {
    constructor() {
        super(l10n.t('{中文名称}'), {
            iconPath: new vscode.ThemeIcon('{图标}'),
            command: {
                command: 'y3-helper.{英文标识}.open',
                title: l10n.t('打开{中文名称}'),
            },
        });
    }
}

// 注册打开命令
vscode.commands.registerCommand('y3-helper.{英文标识}.open', () => {
    if (panel) {
        panel.reveal();
        return;
    }

    panel = vscode.window.createWebviewPanel(
        '{英文标识}',
        '{中文名称}',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
        }
    );

    panel.webview.html = getWebviewContent();

    panel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            // TODO: 处理 WebView 消息
            case 'example':
                vscode.window.showInformationMessage(message.text);
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
        .container { max-width: 800px; margin: 0 auto; }
        h1 { color: #007acc; }
    </style>
</head>
<body>
    <div class="container">
        <h1>{中文名称}</h1>
        <p>TODO: 添加你的 UI 内容</p>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        // TODO: 添加交互逻辑
    </script>
</body>
</html>`;
}
```

**功能分组类型**:
```typescript
import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';

export class {中文名称} extends TreeNode {
    constructor() {
        super(l10n.t('{中文名称}'), {
            iconPath: new vscode.ThemeIcon('{图标}'),
            childs: [
                new TreeNode(l10n.t('子功能1'), {
                    iconPath: new vscode.ThemeIcon('file'),
                    command: {
                        command: 'y3-helper.{英文标识}.func1',
                        title: l10n.t('子功能1'),
                    },
                }),
                new TreeNode(l10n.t('子功能2'), {
                    iconPath: new vscode.ThemeIcon('file'),
                    command: {
                        command: 'y3-helper.{英文标识}.func2',
                        title: l10n.t('子功能2'),
                    },
                }),
            ],
        });
    }
}

// 注册命令
vscode.commands.registerCommand('y3-helper.{英文标识}.func1', () => {
    // TODO: 实现子功能1
    vscode.window.showInformationMessage('子功能1');
});

vscode.commands.registerCommand('y3-helper.{英文标识}.func2', () => {
    // TODO: 实现子功能2
    vscode.window.showInformationMessage('子功能2');
});
```

### Step 3: 显示注册提示

生成代码后，显示以下提示信息：

```markdown
## ✅ 插件代码已生成

**文件**: `src/mainMenu/pages/{英文标识}.ts`

### 还需要完成以下步骤：

#### 1. 在 mainMenu.ts 中注册

打开 `src/mainMenu/mainMenu.ts`，添加：

```typescript
// 在文件顶部添加导入
import { {中文名称} } from './pages/{英文标识}';

// 在 makeMainNode() 的 childs 数组中添加
new {中文名称},
```

#### 2. 在 package.json 中声明命令

打开 `package.json`，在 `contributes.commands` 数组中添加：

```json
{
    "command": "y3-helper.{英文标识}.{命令后缀}",
    "title": "{中文名称}"
}
```

#### 3. 编译测试

```bash
npm run compile
```

按 `F5` 启动调试，检查 Y3Helper 侧边栏是否显示新插件。
```

## 示例执行流程

**用户**: 帮我创建一个 Y3Helper 插件

**AI** (使用 ask_user_question):
> 请输入插件的中文名称（将显示在 Y3Helper 侧边栏）

**用户**: AI助手

**AI** (使用 ask_user_question):
> 请输入插件的英文标识（camelCase，用于文件名和命令ID）

**用户**: aiAssistant

**AI** (使用 ask_user_question):
> 请选择插件的功能类型
> - 简单命令
> - WebView 面板 (Recommended)
> - 功能分组

**用户**: WebView 面板

**AI** (使用 ask_user_question):
> 请选择插件图标
> - hubot (机器人) (Recommended)
> - play (播放)
> - gear (设置)
> ...

**用户**: hubot

**AI**: [生成代码并显示注册提示]

## 参考文档

详细的 API 说明请参考：`openspec/specs/y3helper-plugin-guide/spec.md`
