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

Y3-Helper 内置了 MCP Server，可供 Y3Maker、Codex 和 Claude Code 等 AI 工具连接，用于启动和控制游戏、执行 Lua、读取日志等操作。

使用 VSCode 打开已初始化的 Y3 项目后，MCP Server 会自动启动；也可以在侧边栏的“Y3开发助手”中手动启动或停止服务。

#### Y3Maker

通过 Y3-Helper 初始化项目后，项目根目录的 `.y3maker` 会自动包含所需的 MCP 配置，无需手动添加。直接打开 Y3Maker AI 即可使用。

#### Codex 和 Claude Code

使用 [Y3Maker Migration Skills](https://github.com/BAIMOoo/y3maker-migration-skills) 将项目中的 `.y3maker` 配置迁移到 Codex 或 Claude Code。具体安装和迁移方式请参考该项目的说明。

## 如何对本插件进行二次开发？

1. 安装`vscode`和`Node.js`
2. `git clone` 或其他方式下载本插件项目源码
3. 使用VSCode打开项目文件夹
4. 在终端中使用 `npm install` 命令，安装相关依赖
5. 按下 `ctrl+shift+B` 启动实时编译
6. 按F5启动新的VSCode窗口测试代码
