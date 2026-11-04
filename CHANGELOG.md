# Change Log

All notable changes to the "y3-helper" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- 侧边栏的勾选项、多开玩家、调试器标记和启动地图选择现在会按项目记住，重启 VS Code 后自动恢复。
- 恢复配置时会安全回退失效地图和已移除的玩家，并且不会在启动阶段改写项目文件。
- MCP 的 `launch_game` 支持多开模式：可指定角色列表、自动补齐本地存档昵称，并通过 `roleId` 定位具体游戏窗口。
- 修复切换编辑器路径后继续复用旧提权代理，导致游戏启动被 `path is outside of the allowed directory` 拒绝的问题。
