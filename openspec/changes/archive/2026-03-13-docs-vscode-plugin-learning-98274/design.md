## Context

Y3Helper 是一个 VSCode 扩展，为 Y3 游戏编辑器提供开发辅助功能。其核心 UI 组件是侧边栏的 TreeView（主菜单），通过 `src/mainMenu/` 模块实现。

**现有架构分析**：
- `TreeNode` 类：继承自 `vscode.TreeItem`，是所有菜单节点的基类
- `TreeProvider` 类：实现 `vscode.TreeDataProvider` 接口，管理树节点的数据和刷新
- `mainMenu.ts`：组装所有菜单节点，注册 TreeView 到 VSCode
- `pages/` 目录：每个页面/功能模块继承 `TreeNode`，封装特定功能

**关键发现**：
- 菜单节点通过 `childs` 属性组织层级结构
- 节点可配置 `command` 属性绑定 VSCode 命令
- 节点可配置 `show` 属性控制动态显示/隐藏
- 节点可配置 `update` 属性实现动态内容更新

## Goals / Non-Goals

**Goals:**
- 产出《Y3Helper 插件开发指南》文档，覆盖：
  - 如何新增一个 TreeView 菜单节点
  - 如何绑定命令和图标
  - 如何打开 WebView 窗口
  - 如何注册和调用 VSCode 命令
- 产出通用 Skill，用于自动化生成新插件的脚手架代码

**Non-Goals:**
- 不实现「AI助手」插件的具体功能
- 不修改 Y3Helper 现有代码
- 不涉及 MCP Server 或其他高级功能的学习

## Decisions

### Decision 1: 文档结构采用分层组织

**选择**：将文档分为「快速开始」和「详细参考」两部分

**理由**：
- 快速开始：3-5 分钟内能跑通一个最小示例
- 详细参考：深入解释各个 API 和最佳实践

**替代方案**：单一长文档 → 不利于快速上手

### Decision 2: Skill 采用交互式问答模式

**选择**：Skill 通过 `ask_user_question` 收集插件名称、图标、功能类型等信息，再生成代码

**理由**：
- 不同插件需求差异大（纯命令 vs WebView vs 复杂交互）
- 交互式能生成更精准的脚手架代码

**替代方案**：固定模板 → 灵活性不足

### Decision 3: 示例以「AI助手」插件为蓝本

**选择**：文档示例直接使用「AI助手」插件作为案例

**理由**：
- 贴合后续开发需求
- 具体案例比抽象示例更易理解

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| Y3Helper 架构可能更新 | 文档标注版本，定期 review |
| WebView 开发涉及前端知识 | 文档提供简化的 HTML 模板 |
| Skill 可能无法覆盖所有场景 | 明确 Skill 适用范围，复杂场景建议手动开发 |

## Open Questions

- [ ] WebView 是否需要使用 React/Vue 等框架？还是纯 HTML？
- [ ] 「AI助手」插件是否需要与外部 AI 服务通信？（影响文档是否覆盖网络请求）
