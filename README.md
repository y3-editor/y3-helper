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

## 本地云脚本调试（Windows）

普通打开或切换项目不会修改 `main.lua`。勾选「启动后附加本地云脚本」、通过 Helper 自动调试启动，或在命令面板执行「启用本地云脚本调试」时，才会在 `cloud_script/main.lua` 开头写入或刷新带标记的调试引导。检查 `loadfile`、`io.open`、`os.getenv`、`package.loadlib` 均可用后，从本机 Lua Debug 插件加载 debugger；任一接口缺失则直接继续业务，不注册事件、不加载本机文件。该判断依赖当前本地／远程宿主的接口约定，不使用进程注入。

- **Helper 启动**：勾选「附加调试器 → 启动后附加本地云脚本」后启动，等待调试配置完成再执行后续 `require`，可捕获入口业务断点。连接失败或 30 秒未就绪时可重试或继续，关闭 Helper 也会释放等待。
- **编辑器启动**：先执行「启用本地云脚本调试」，再启动游戏。启动时不等待，可在 VS Code「运行与调试」的配置下拉菜单中选择 Lua Debug 提供器下的「附加本地云脚本」动态配置进行连接，但可能错过入口断点。
- **本地多开／正式服**：当前宿主缺少上述接口，引导直接跳过。无需手动切换或注释调试模式。

取消自动附加只关闭自动连接，保留已有引导。需要清理时执行「移除本地云脚本调试引导」，仅删除标记块并关闭自动附加；未保存的修改或不完整标记会阻止修改。手动附加发现引导缺失时只提示启用并重启游戏，不会临时改写入口。

Helper 不创建或修改 `launch.json`。需要自定义地址、源码映射或暂停策略时，可自行保存调试配置；动态配置按当前项目生成。

依赖 `actboy168.lua-debug`，使用固定地址 `127.0.0.1:12306`，仅支持一个本地云脚本实例。首次准备或更新引导后需重新启动游戏。项目迁移或插件升级后，主动启用调试或通过 Helper 自动调试启动可刷新本机路径；业务入口中的原有代码会保留。本地加载出错时由 `pcall` 捕获并记录警告，继续业务执行。

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

VSCode 1.102 及以上的内置 AI（Copilot Chat 等）无需任何配置：扩展会注册 MCP Server Definition Provider，自动把该服务提供给 VSCode。其他工具（Y3Maker / Claude Code / Codex）需手动配置，服务地址为 `http://127.0.0.1:8766/mcp`。

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
