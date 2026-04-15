## Why

#98274

需要在 Y3Helper 中新增一个「AI助手」插件功能，但在动手编码前，需要先学习 VSCode 插件开发流程以及 Y3Helper 现有的插件架构。本单子的目标是产出学习文档，为后续实际开发提供参考。

## What Changes

- **不涉及代码修改**：本单子仅进行学习和文档编写
- 学习 VSCode Extension API 中与 TreeView、WebView 相关的知识
- 分析 Y3Helper 现有的目录树结构实现
- 总结如何在 Y3Helper 中新增一个插件节点
- 产出可复用的开发文档
- **产出通用 Skill**：创建一个用于生成 Y3Helper 插件的 CodeMaker Skill

## Capabilities

### New Capabilities
- `y3helper-plugin-guide`: Y3Helper 插件开发指南文档，包含新增插件节点的完整流程
- `y3helper-plugin-skill`: CodeMaker Skill，用于自动化生成 Y3Helper 新插件的脚手架代码

### Modified Capabilities
<!-- 本单子不修改现有功能 -->

## Impact

- 不影响现有代码
- 产出的文档将作为后续「AI助手」插件开发的参考依据
- 文档位置：`openspec/specs/y3helper-plugin-guide/`
- Skill 位置：`.codemaker/skills/y3helper-plugin-generator.md`
