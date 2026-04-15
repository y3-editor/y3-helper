# Y3 MMO 项目 - CodeMaker 配置

本项目使用 CodeMaker AI 辅助开发，启动前请确保以下环境配置正确。

---

## 🚀 环境检测清单

### 必需的 MCP 服务

| MCP 服务 | 用途 | 检测方式 |
|----------|------|----------|
| **Redmine MCP Server** | 易协作工单管理 | 输入 `查看我的项目` |
| **POPO MCP** | 发送消息通知 | 需配置机器人 identify/secret |

### 推荐安装

1. **Redmine MCP Server (易协作)**
   - 支持工单查询、创建、更新
   - 配置方法：在 CodeMaker 设置中添加易协作 MCP

2. **POPO MCP**
   - 支持通过自定义机器人发送消息
   - 需要在 POPO 群/对话中创建自定义机器人

---

## 📋 可用 Agent

| Agent | 说明 | 调用方式 |
|-------|------|----------|
| `@Y3PM` | OpenSpec 工作流管理 | `@Y3PM 创建新任务` |

---

## 🔗 快速开始

```bash
# 1. 创建新的变更（需要单号）
/opsx:new <描述>

# 2. 快速生成所有文档
/opsx:ff <change-name>

# 3. 执行任务
/opsx:apply

# 4. 归档变更
/opsx:archive
```

---

## 📂 相关文件

- Agent 定义：`.codemaker/agents/`
- 规则定义：`.codemaker/rules/`
- 知识库索引：`openspec/spec.md`
- 归档记录：`openspec/specrecord.csv`

---

*如有问题，请联系项目负责人*
