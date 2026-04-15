import type { BuiltInPrompt } from './index';

export const RULES_PROMPT: BuiltInPrompt = {
  name: 'Rules',
  description: '分析代码库并生成 AI 编码规则文件',
  prompt: `Analyze this codebase and create a \`.y3maker/rules/rules.mdc\` file to guide AI coding agents. The main goal is to help the AI make logically correct, safe, and high-performance code changes, specifically tailored for game development contexts.
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
\`\`\``,
};
