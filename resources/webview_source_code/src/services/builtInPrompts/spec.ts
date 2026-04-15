import type { BuiltInPrompt } from './index';

export const OPEN_SPEC_SETUP_PROMPT: BuiltInPrompt = {
  name: 'openspec-setup',
  description: '在当前仓库初始化 OpenSpec 环境',
  prompt: `在当前仓库初始化 OpenSpec 运行环境，全部完成后告诉用户："已完成 OpenSpec 环境初始化并设置好项目规范，现在可以通过 /openspec-proposal 指令创建变更提案。"

## 执行步骤：生成项目规范（约 3-5 分钟）

Analyze this codebase and create a \`.y3maker/rules/rules.mdc\` file to guide AI coding agents. The main goal is to help the AI make logically correct, safe, and high-performance code changes, specifically tailored for game development contexts.
To accelerate future interactions and avoid repetitive context retrieval, you must extract key definitions and patterns into the rule file.
Include the following in the file:
1.  **High-Level Overview:**
    *   Big-picture architecture.
    *   Application entry points and main game loops.
2.  **Code Style & Consistency Enforcers:**
    *   **Naming Conventions:** Analyze and strictly define naming rules for Classes, Variables, Functions, and Files.
    *   **Header/Footer Standards:** Note any required file headers.
    *   **Type Hinting & Comments:** Define the expected comment style and strictness of type enforcement.
3.  **Rapid Reference & Context Map:**
    *   *Extract this information to prevent the AI from needing to search for it repeatedly:*
    *   **Core Utilities:** List the top 5-10 most frequently used utility functions with their **exact signatures**.
    *   **Key Constants:** List critical Game IDs, Currency IDs, or Error Codes that appear frequently.
    *   **Common Entity/Object Access:** How to access the \`Player\`, \`Backpack\`, or \`UI Root\` globally.
4.  **Game-Specific Patterns:**
    *   **Async & Concurrency:** Define the standard pattern for asynchronous operations.
    *   **Lifecycle Management:** Rules for \`Init\` -> \`StartUp\` -> \`ShutDown\`. Emphasize **cleaning up timers and listeners**.
    *   **Performance:** Rules for UI caching, Batch APIs, and hot-path optimizations.
    *   **Error Handling:** Standard patterns for checking server callbacks.
5.  **Developer Workflows:**
    *   Commands for setup, building, and **running a single test case**.
    *   Scaffolding templates: Provide a minimal code skeleton for creating a new **Test Case** or **UI Widget**.
**Important:**
*   **Style Consistency is Law:** The AI must match the existing indentation, import ordering, and variable naming exactly.
*   **Zero-Hallucination:** Only include APIs and constants that actually exist in the analyzed codebase.
*   **Merge Existing Rules:** If \`.y3maker/rules/rules.mdc\` or similar files exist, merge their contents.
The generated file **must** use the following format:
\`\`\`
---
description: AI coding guidance and rules for this repository.
alwaysApply: true
---
<rule>
{{rules}}
</rule>
\`\`\`

## 完成后

告诉用户：已完成 OpenSpec 环境初始化并设置好项目规范，现在可以通过 /openspec-proposal 指令创建变更提案。`,
};

export const SPECKIT_SETUP_PROMPT: BuiltInPrompt = {
  name: 'speckit-setup',
  description: '在当前仓库初始化 SpecKit 环境',
  prompt: `在当前仓库初始化 SpecKit 运行环境，全部完成后告诉用户："已完成 SpecKit 环境初始化并设置好项目规范，现在可以通过 /speckit.specify 指令创建功能规格说明"

## 执行步骤：生成项目规范（约 3-5 分钟）

更新位于 \`.specify/memory/constitution.md\` 的项目规范。该文件是一个包含方括号占位符标记的模板（例如 \`[PROJECT_NAME]\`、\`[PRINCIPLE_1_NAME]\`）。你的任务是：(a) 收集/推导具体值，(b) 精确填充模板，(c) 将修改传播到依赖的产物中。

按以下流程执行：

1. 加载位于 \`.specify/memory/constitution.md\` 的现有规范模板。
   - 识别所有形如 \`[ALL_CAPS_IDENTIFIER]\` 的占位符标记。
   **重要**：用户可能需要比模板中更少或更多的原则。如果指定了数量，请遵循该要求——按照通用模板进行。你需要相应地更新文档。

2. 收集/推导占位符的值：
   - 如果用户输入（对话）提供了值，使用该值。
   - 否则从现有仓库上下文推断（README、文档、之前嵌入的规范版本）。
   - 对于治理日期：\`RATIFICATION_DATE\` 是原始采用日期（如果未知则询问或标记 TODO），\`LAST_AMENDED_DATE\` 如果有修改则为今天，否则保持之前的值。
   - \`CONSTITUTION_VERSION\` 必须按照语义化版本规则递增：
     - MAJOR：不向后兼容的治理/原则删除或重新定义。
     - MINOR：添加新原则/章节或实质性扩展指导。
     - PATCH：澄清、措辞、错别字修复、非语义性改进。
   - 如果版本升级类型不明确，在最终确定前先提出推理说明。

3. 起草更新后的规范内容：
   - 用具体文本替换每个占位符（不留任何方括号标记，除非是项目选择暂不定义的模板槽位——需明确说明保留原因）。
   - 保留标题层级，替换后可移除注释，除非它们仍提供有价值的指导。
   - 确保每个原则章节包含：简洁的名称行、捕获不可协商规则的段落（或项目符号列表）、如果不明显则提供明确的理由。
   - 确保治理章节列出修订程序、版本策略和合规审查预期。

4. 一致性传播检查清单（将先前的检查清单转换为主动验证）：
   - 阅读 \`.specify/templates/plan-template.md\`，确保任何"规范检查"或规则与更新后的原则保持一致。
   - 阅读 \`.specify/templates/spec-template.md\` 检查范围/需求对齐——如果规范添加/删除了强制章节或约束则进行更新。
   - 阅读 \`.specify/templates/tasks-template.md\`，确保任务分类反映新增或删除的原则驱动任务类型（例如可观测性、版本管理、测试规范）。
   - 阅读 \`.specify/templates/commands/*.md\` 中的每个命令文件（包括此文件），验证在需要通用指导时没有过时的引用（如仅限 CLAUDE 的代理特定名称）。
   - 阅读任何运行时指导文档（例如 \`README.md\`、\`docs/quickstart.md\` 或代理特定的指导文件，如果存在的话）。更新对已更改原则的引用。

5. 生成同步影响报告（更新后在规范文件顶部以 HTML 注释形式添加）：
   - 版本变更：旧版本 → 新版本
   - 已修改原则列表（如果重命名则列出：旧标题 → 新标题）
   - 新增章节
   - 删除章节
   - 需要更新的模板（✅ 已更新 / ⚠ 待处理）及文件路径
   - 后续 TODO（如果有意推迟的占位符）

6. 最终输出前的验证：
   - 没有未解释的方括号标记。
   - 版本行与报告匹配。
   - 日期使用 ISO 格式 YYYY-MM-DD。
   - 原则是声明性的、可测试的，且没有模糊语言（"should" → 适当时替换为 MUST/SHOULD 并附带理由）。

7. 将完成的规范写回 \`.specify/memory/constitution.md\`（覆盖）。

8. 向用户输出最终摘要：
   - 新版本和升级理由。
   - 任何标记为需要手动跟进的文件。
   - 建议的提交信息（例如 \`docs: amend constitution to vX.Y.Z (principle additions + governance update)\`）。

格式和样式要求：

- 使用与模板完全一致的 Markdown 标题（不要降级/升级层级）。
- 换行以保持可读性（理想情况下 <100 字符），但不要通过不自然的断行来强制执行。
- 章节之间保持一个空行。
- 避免尾随空格。

如果用户提供部分更新（例如仅修改一个原则），仍需执行验证和版本决策步骤。

如果缺少关键信息（例如批准日期确实未知），插入 \`TODO(<FIELD_NAME>): explanation\` 并在同步影响报告的延迟项目中包含它。

不要创建新模板；始终在现有的 \`.specify/memory/constitution.md\` 文件上操作。

## 完成后

告诉用户：已完成 SpecKit 环境初始化并设置好项目规范，现在可以通过 /speckit.specify 指令创建功能规格说明。`,
};
