# English Version

[README-EN.md](./README-EN.md)

# Y3开发助手

## 安装

### 方式一：从 GitHub Release 下载

1. 在 [Releases 页面](https://github.com/y3-editor/y3-helper/releases) 下载最新版本的 `.vsix` 文件
2. 在 VSCode 中按 `Ctrl+Shift+P`，执行 `Extensions: Install from VSIX...`，选择该文件安装

### 方式二：从源码构建

```bash
git clone https://github.com/y3-editor/y3-helper.git
cd y3-helper
npm install
npm run vscode:prepublish
npx vsce package
```

然后安装生成的 `.vsix` 文件。

## 初始化项目（仅新地图，老地图勿用！）

1. 点击左侧栏“Y3开发助手”图标，点击“初始化”
2. 选择地图路径
3. 选择是否拉取 Y3Maker 配置（`.y3maker` 目录，可选）
4. 完成！

第 3 步只对这次生效，不会替你改设置。想让以后的项目都不再询问，可以把设置 `Y3-Helper.CloneY3MakerConfig` 改成 `always`（自动拉取）或 `never`（完全不碰）。跳过也没关系，主菜单会留下“Y3Maker 配置未初始化”节点，随时能拉。

如果项目里已有 `.y3maker` 但它不是 git 仓库（比如你只加过几个技能），扩展不会直接覆盖，而是问你要“合并 / 备份并替换 / 稍后再说”。备份存成带时间戳的 `.y3maker.bak-<时间>`，不会盖掉上一次的备份。

## 功能面板

包含“启动游戏”、“在编辑器中打开”、“查看日志”等常用功能。使用此助手启动游戏后，游戏会连接到开发助手，并额外提供：

1. 一键热重载
2. 在“自定义视图”区显示仪表盘，可监控游戏状态并快速重启
3. 在 VSCode 的“终端”区使用远程终端，显示游戏日志以及执行命令

## 本地云脚本调试

依赖 `actboy168.lua-debug` 插件，仅支持一个本地云脚本实例。

- **Helper 启动**：勾选「附加调试器 → 启动后附加本地云脚本」后启动游戏，等连接完成再执行后续操作，可停在业务入口断点；连接失败或 30 秒未就绪时可以重试或继续。
- **编辑器启动**：先执行「启用本地云脚本调试」，再启动游戏，然后在「运行与调试」中选择 Lua Debug 提供器下的「附加本地云脚本」连接，但可能错过入口断点。

本地多开和正式服会自动跳过，无需手动切换或注释调试模式。普通打开或切换项目不会改动代码，只有上述操作会在 `cloud_script/main.lua` 开头写入带标记的调试引导；首次写入或更新引导后需重启游戏。

取消自动附加只关闭自动连接，引导仍保留在文件中；需要清理时执行「移除本地云脚本调试引导」，只删除标记块并关闭自动附加（未保存的修改或不完整标记会阻止修改）。

## 物编支持

打开地图后，可以在 `资源管理器/Y3开发助手：物编数据` 中浏览、编辑物编数据（`.json` 文件）。

打开物编 json 文件后，可在 `资源管理器/大纲/Y3开发助手：物编字段` 视图中以中文查看和跳转字段。

### 搜索

按下 `Ctrl+T` 即可搜索物编，例如 `#关羽` 搜索名称中带有“关羽”的所有物编，`#关羽.移动速度` 直接定位到指定物编字段。

> 也可以使用数字 key 与英文字段名来搜索。分割符支持 `.` 和 `/`。

## 高级应用

### 自定义视图

你可以自己在自定义视图上画按钮，见[演示代码](https://github.com/y3-editor/y3-lualib/blob/main/%E6%BC%94%E7%A4%BA/Y3%E5%BC%80%E5%8F%91%E5%8A%A9%E6%89%8B/%E8%87%AA%E5%AE%9A%E4%B9%89%E8%A7%86%E5%9B%BE.lua)

### 远程终端

可以在地图发布到平台后，利用远程终端功能调试线上地图。

> 应当只在测试服中启用此功能。

1. 在代码中埋入初始化代码，如：
    ```lua
    y3.game:event('玩家-发送指定消息', 'Link Start', function (trg, data)
        y3.develop.helper.init(11037)
    end)
    -- 允许在平台中执行本地代码
    y3.config.code.enable_local = true
    ```
2. 在 VSCode 设置中将 `Y3-Helper.ServerPort` 改为相同端口号 `11037`
3. 重启 VSCode，确保插件应用了新的端口号
4. 点击侧边栏的“Y3开发助手”图标，确保此助手已启动
5. 执行到第 1 步埋入的 `y3.develop.helper.init(11037)`，即可连接到远程终端

### 插件

插件是存放在你地图中的 JavaScript 脚本，可以手动或自动运行里面的代码，实现批量修改物编、生成 Lua 文件等功能。

在侧边栏的“Y3开发助手”中点击 `插件/初始化`，会在 `script/y3-helper/plugin` 目录生成演示文件，目前包含：

* `1-使用代码修改物编.js`
* `2-自动执行的脚本.js`
* `3-读取excel.js`
* `4-excel生成物编.js`
* `5-excel生成物编·极.js`
* `6-更多的演示` （会根据作者需求逐步更新）

### MCP

Y3-Helper 内置 MCP Server，可供 Y3Maker、Codex 和 Claude Code 等 AI 工具连接，用于启动和控制游戏、执行 Lua、读取日志等操作。

用 VSCode 打开已初始化的 Y3 项目后，MCP Server 会自动启动；也可以在侧边栏的“Y3开发助手”中手动启动或停止。

VSCode 1.102 及以上的内置 AI（Copilot Chat 等）无需配置：扩展会注册 MCP Server Definition Provider，自动把服务提供给 VSCode。其他工具（Y3Maker / Claude Code / Codex）需手动配置，服务地址为 `http://127.0.0.1:8766/mcp`。

#### Y3Maker

初始化时选择拉取，项目根目录的 `.y3maker` 就会带上 MCP 配置，直接打开 Y3Maker AI 就能用。跳过也没关系，点主菜单的“Y3Maker 配置未初始化”补上即可。

#### Codex 和 Claude Code

使用 [Y3Maker Migration Skills](https://github.com/BAIMOoo/y3maker-migration-skills) 将项目中的 `.y3maker` 配置迁移到 Codex 或 Claude Code，安装和迁移方式见该项目说明。

## 如何对本插件进行二次开发？

1. 安装 `vscode` 和 `Node.js`
2. `git clone` 或其他方式下载本插件项目源码
3. 使用 VSCode 打开项目文件夹
4. 在终端中使用 `npm install` 安装相关依赖
5. 按下 `ctrl+shift+B` 启动实时编译
6. 按 F5 启动新的 VSCode 窗口测试代码
