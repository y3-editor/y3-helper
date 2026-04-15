# Bug Fix: @面板无法自动选中当前打开的文件

**日期**: 2026-03-25
**类型**: Bug Fix（直接修复，未走 OpenSpec 流程）
**影响模块**: CodeMaker 集成 — 文件搜索与 @ 面板

## 问题描述

使用 `@` 打开工具面板（文件附件选择器）时，无法自动选中当前打开的文件，也不显示"当前"标签。源码版 CodeMaker 功能正常。

## 根因分析

集成版在移植时遗漏了两个源码版核心模块：

| 模块 | 源码位置 | 作用 |
|---|---|---|
| `workspaceTracker` | `handlers/workspaceTracker/index.ts` | 初始化时 BFS 扫描工作区全量文件（最多 2000 个），存入 `filePaths` Set；监听文件创建事件动态更新 |
| `openFilesHandler` | `handlers/openFilesHandler.ts` | 监听 `onDidChangeActiveTextEditor` 记录最近打开的文件（按时间排序），跨 session 通过 `globalState` 缓存 |

集成版之前的 `_searchWorkspacePaths` 使用 `vscode.workspace.findFiles` 随机搜索文件，当前活动文件经常不在结果集中，导致：
1. 文件列表不含当前文件
2. 没有文件被标记 `isActive: true`
3. 前端无法显示"当前"标签

## 修复内容

### 新增文件
- `src/codemaker/handlers/workspaceTracker.ts` — 移植自源码版，`listFilesBfs` 用 `vscode.workspace.findFiles` 替代（集成版无 `globby` 依赖）
- `src/codemaker/handlers/openFilesHandler.ts` — 移植自源码版，包含 `getDocumentLanguage` 内联
- `src/codemaker/utils/file.ts` — `isDocsetFile` 工具函数（判断 PDF/DOC 等二进制文件）

### 修改文件
- `src/codemaker/index.ts` — `initCodeMaker` 中添加 `initOpenFilesHandler(context)` 和 `initWorkspaceTracker()`
- `src/codemaker/webviewProvider.ts` — `_searchWorkspacePaths` 完全按源码版 `searchWorkspacePath.ts` 重写

### 核心流程（与源码版完全一致）

```
启动 → initWorkspaceTracker() 扫描全量文件
     → initOpenFilesHandler(context) 监听编辑器切换

@面板请求(GET_WORKSPACE_FILES) 
  → _searchWorkspacePaths(keyword, max, type, folderDisabled=true)
    → workspaceTracker.getFilePaths({keyword, type})  // 全量文件
    → openFilesHandler.getRecentlyOpenedTop(10)        // 最近打开文件
    → 去重合并 → 逐个加载内容
    → 当前活动文件标记 isActive: true 并 unshift 到最前
    → 兜底：活动文件不在结果中 → 强制插入
```

### 关键源码参考（源码版）

| 文件 | 路径 |
|---|---|
| searchWorkspacePath | `H:\CodemakerOpenSource\packages\extension\src\utils\searchWorkspacePath.ts` |
| workspaceTracker | `H:\CodemakerOpenSource\packages\extension\src\handlers\workspaceTracker\index.ts` |
| openFilesHandler | `H:\CodemakerOpenSource\packages\extension\src\handlers\openFilesHandler.ts` |
| getDocumentLanguage | `H:\CodemakerOpenSource\packages\extension\src\utils\getDocumentLanguage.ts` |
| isDocsetFile | `H:\CodemakerOpenSource\packages\extension\src\utils\file.ts` L128-131 |
| GET_WORKSPACE_FILES 调用 | `H:\CodemakerOpenSource\packages\extension\src\provider\webviewProvider\index.ts` L971-975 |

## 经验教训

1. **不要自己发挥实现逻辑** — 源码版已有正确实现，直接移植是最可靠的方式
2. **`@` 面板依赖的模块链比看上去长** — 不只是一个搜索函数，还依赖 workspaceTracker（全量文件索引）和 openFilesHandler（最近文件追踪）
3. **`listFilesBfs` 依赖 `globby`** — 集成版没有这个依赖，用 `vscode.workspace.findFiles` 替代是合理的，效果等价
