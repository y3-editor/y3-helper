# Change Log

All notable changes to the "y3-helper" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- 侧边栏的勾选项、多开玩家、调试器标记和启动地图选择现在会按项目记住，重启 VS Code 后自动恢复。
- 恢复配置时会安全回退失效地图和已移除的玩家，并且不会在启动阶段改写项目文件。
- MCP 的 `launch_game` 支持多开模式：可指定角色列表、自动补齐本地存档昵称，并通过 `roleId` 定位具体游戏窗口。
- 修复切换编辑器路径后继续复用旧提权代理，导致游戏启动被 `path is outside of the allowed directory` 拒绝的问题。
- 修复多开 `forceKillAll` 无法清理已脱离代理跟踪的多开游戏窗口的问题。
- 修复多开单窗口 `quick_restart` 在整组窗口一起重连时可能返回并绑定到其它角色的问题。
- MCP 多开启动会传递 `lua_multi_mode` / `lua_multi_debug_players`，客户端状态中的 `multiMode` 现在正确显示为 `true`。
- MCP 多开的 `players` 支持任意正整数玩家槽位，缺失角色会自动补齐到 `campinfo.json` 和阵营 `role_ids` 后再启动。
