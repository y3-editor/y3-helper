# English Version

[README-EN.md](./README-EN.md)

# Y3开发助手

## 安装

### 方式一：从 GitHub Release 下载

1. 访问 [Releases 页面](https://github.com/y3-editor/y3-helper/releases)
2. 下载最新版本的 `.vsix` 文件
3. 在 VSCode 中按 `Ctrl+Shift+P`，输入 `Extensions: Install from VSIX...`
4. 选择下载的 `.vsix` 文件进行安装

### 方式二：从源码构建

```bash
git clone https://github.com/y3-editor/y3-helper.git
cd y3-helper
npm install
npm run vscode:prepublish
npx vsce package
```

然后安装生成的 `.vsix` 文件。

## 初始化项目（给新建的地图使用，老地图勿用！）

1. 点击左侧栏“Y3开发助手”图标，点击“初始化”
2. 选择地图路径
3. 完成！

## 功能面板

包含“启动游戏”、“在编辑器中打开”、“查看日志”等常用功能。

当使用此助手启动游戏后，游戏会连接到开发助手，并额外提供以下功能：

1. 一键热重载
2. 在“自定义视图”区显示仪表盘，可以监控游戏状态并快速重启
3. 在VSCode的“终端”区使用远程终端，显示游戏日志以及执行命令

## 物编支持

打开地图后，可以在 `资源管理器/Y3开发助手：物编数据` 中浏览、编辑物编数据（`.json`文件）。

打开物编json文件后，在 `资源管理器/大纲/Y3开发助手：物编字段` 视图中以中文查看和跳转字段。

### 搜索

按下 `Ctrl+T` 即可搜索物编，例如使用 `#关羽` 来搜索名称中带有 “关羽” 的所有物编。使用 `#关羽.移动速度` 来搜索到指定的物编字段。

> 也可以使用数字key与英文字段名来搜索。分割符支持 `.` 和 `/`。

## 高级应用

### 自定义视图

你可以自己在自定义视图上画按钮，见[演示代码](https://github.com/y3-editor/y3-lualib/blob/main/%E6%BC%94%E7%A4%BA/Y3%E5%BC%80%E5%8F%91%E5%8A%A9%E6%89%8B/%E8%87%AA%E5%AE%9A%E4%B9%89%E8%A7%86%E5%9B%BE.lua)

### 远程终端

可以在地图发布到平台后，利用远程终端功能调试线上地图

> 应当只在测试服中启用此功能

1. 在代码中埋入初始化代码，如：
    ```lua
    y3.game:event('玩家-发送指定消息', 'Link Start', function (trg, data)
        y3.develop.helper.init(11037)
    end)
    -- 允许在平台中执行本地代码
    y3.config.code.enable_local = true
    ```
2. 在VSCode的设置中将 `Y3-Helper.ServerPort` 改为上述相同的端口号 `11037`
3. 重启VSCode，确保插件应用了新的端口号
4. 点击一下侧边栏的“Y3开发助手”图标，确保此助手已启动
5. 通过第1步中埋入的初始化代码，执行到 `y3.develop.helper.init(11037)` 即可连接到远程终端

### 插件

插件是存放在你地图中的JavaScript脚本，可以手动或自动运行里面的代码，实现批量修改物编、生成Lua文件等功能。

在侧边栏的“Y3开发助手”中点击 `插件/初始化` 后会在 `script/y3-helper/plugin` 目录中生成演示文件，目前包含：

* `1-使用代码修改物编.js`
* `2-自动执行的脚本.js`
* `3-读取excel.js`
* `4-excel生成物编.js`
* `5-excel生成物编·极.js`
* `6-更多的演示` （会根据作者需求逐步更新）

### MCP

Y3-Helper MCP Server 是一个基于 Model Context Protocol (MCP) 的服务，让 Claude Code 能够自动化控制 Y3 游戏的开发、测试和调试流程。

#### 快速配置

**Windows 原生环境**

如果你在 Windows 上直接使用 Claude Code（非 WSL），可以通过以下步骤一键配置：

1. 在侧边栏的”Y3开发助手”中点击 `MCP Server/配置 MCP (Windows)`
2. 扩展会自动检测 Claude CLI 并完成配置
3. 配置成功后，在命令行中启动 `claude`，输入 `/mcp` 检查连接是否正常

**WSL 环境**

如果你在 Windows 上使用 WSL 环境的 Claude Code，可以通过以下步骤一键配置：

1. 在侧边栏的”Y3开发助手”中点击 `MCP Server/配置 MCP (WSL)`
2. 扩展会自动检测 WSL 和 Claude CLI，并完成配置
3. 配置成功后，在 WSL 终端中启动 `claude`，输入 `/mcp` 检查连接是否正常

#### 手动配置
在对应环境的终端中运行以下命令:
```
claude mcp add -s user y3-helper -- node.exe "C:\\Users\\<用户名>\\.vscode\\extensions\\sumneko.y3-helper-1.xx.x\\dist\\mcp-server.js"

# 双引号内为y3开发扩展路径，以按照下面的步骤来替换双引号内的字符串

1. 在 VSCode 中按 `Ctrl+Shift+P`

2. 输入 "Developer: Open Extensions Folder"

3. 找到 `sumneko.y3-helper-1.xx.x` 目录

4. MCP Server 文件位于该目录下的 `dist/mcp-server.js`

5. 将路径替换到前面的命令中

```

在侧边栏的”Y3开发助手”中点击 `MCP Server/启动 MCP Server` 后，启动 Claude Code 并输入 `/mcp` 检查链接是否正常。


#### 更新MCP配置
插件版本更新后，由于路径会改变，需要重新配置 MCP Server
**自动配置**
点击侧边栏配置按钮即可，如果自动配置失败，请手动配置

**手动配置**
```
先删除原本的配置
claude mcp remove y3-helper

再添加新的配置
claude mcp add -s user y3-helper -- node.exe "C:\\Users\\<用户名>\\.vscode\\extensions\\sumneko.y3-helper-1.xx.x\\dist\\mcp-server.js"
```

## 如何对本插件进行二次开发？

1. 安装`vscode`和`Node.js`
2. `git clone` 或其他方式下载本插件项目源码
3. 使用VSCode打开项目文件夹
4. 在终端中使用 `npm install` 命令，安装相关依赖
5. 按下 `ctrl+shift+B` 启动实时编译
6. 按F5启动新的VSCode窗口测试代码
