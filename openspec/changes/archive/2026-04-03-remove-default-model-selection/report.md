# 【AI进化】- 【重构-移除CodeMaker内置默认模型】

**需求制作人**: 王浩辰
**AI 生成代码**: 客户端 236 行
**AI 代码占比**: 100%

---

**核心痛点**: Y3Helper 集成的 CodeMaker 面向外部用户，用户通过自行配置 API Key + Base URL + 模型名称接入各种 AI 服务商。代码中保留了 CodeMaker 原有的内置模型列表（Claude、GLM 等 40+ 个模型）和 defaultModel 回退逻辑，这些内置模型对外部用户无意义，且在模型匹配失败时产生模型下架回退、token 计算异常等边缘问题。此外，配置热更新时 Base URL 未通过请求体传递，导致更换 API 配置后必须重启窗口才能生效。

**落地成效**: 基于 spec-driven 工作流完成从需求到落地，AI 代码占比 100%。变更涉及 API Server（config.mjs/ai-provider.mjs）、Extension 后端（apiServer.ts/index.ts）、前端 WebView（chatModel.ts/chat-config.ts/ChatModelSelector.tsx/chat.ts/config.ts/App.tsx）、配置文件（package.json）共 12 个文件，净减 126 行代码（删除大量内置模型定义），新增 55 行精简逻辑。修复了配置热更新问题，实现零代价无感知的配置切换。

**关键方法**: 通过 OpenSpec spec-driven 工作流，先梳理 proposal 明确影响范围，再通过 design 文档确定 6 个关键技术决策（API Server 去 defaultModel、前端 CHAT_MODELS_MAP 清空、fixedModel 语义变更、chat-config 默认值处理、模型选择器交互禁用、请求体携带 base_url），最后生成 tasks 逐步实施。实施过程中通过实际打包测试发现 3 个额外问题（WebView 未重编译、模型选择器 useEffect 回退逻辑、配置热更新 base_url 缺失）并即时修复。

**[解决分享]**: 移除内置默认值类的重构需要特别关注"回退链"——代码中多处 fallback 逻辑会在默认值清空后暴露问题。建议先通过 grep 搜索所有引用点，在 design 阶段就标记出所有需要处理的回退分支，避免实施时遗漏。配置热更新问题提示我们：当配置通过多条路径传递时（环境变量 vs 请求体），需要确保所有路径在配置变化时都能同步更新。
