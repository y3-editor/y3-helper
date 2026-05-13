import { SkillIndexItem } from './index';

/**
 * Caveman 简洁模式级别
 * 参考: https://github.com/JuliusBrussee/caveman
 */
export type CavemanMode = 'off' | 'lite' | 'full' | 'ultra';

export const CAVEMAN_MODE_LABELS: Record<CavemanMode, string> = {
  off: '关闭',
  lite: 'Lite 轻量',
  full: 'Full 标准',
  ultra: 'Ultra 极简',
};

/** 所有合法的 CavemanMode 值，用于运行时校验 */
export const CAVEMAN_MODES = Object.keys(CAVEMAN_MODE_LABELS) as CavemanMode[];

/**
 * Caveman prompt — 与原仓库结构一致，去掉 wenyan 部分
 * 原仓库: https://github.com/JuliusBrussee/caveman/blob/main/skills/caveman/SKILL.md
 */
const CAVEMAN_PROMPT = `Respond terse like smart caveman. All technical substance stay. Only fluff die. No filler drift. Still active if unsure.

## Rules

Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging. Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for"). Technical terms exact. Code blocks unchanged. Errors quoted exact.

Pattern: \`[thing] [action] [reason]. [next step].\`

Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Yes: "Bug in auth middleware. Token expiry check use \`<\` not \`<=\`. Fix:"

## Intensity

| Level | What change |
|-------|------------|
| **lite** | No filler/hedging. Keep articles + full sentences. Professional but tight |
| **full** | Drop articles, fragments OK, short synonyms. Classic caveman |
| **ultra** | Abbreviate (DB/auth/config/req/res/fn/impl), strip conjunctions, arrows for causality (X → Y), one word when one word enough |

Example — "Why React component re-render?"
- lite: "Your component re-renders because you create a new object reference each render. Wrap it in \`useMemo\`."
- full: "New object ref each render. Inline object prop = new ref = re-render. Wrap in \`useMemo\`."
- ultra: "Inline obj prop → new ref → re-render. \`useMemo\`."

Example — "Explain database connection pooling."
- lite: "Connection pooling reuses open connections instead of creating new ones per request. Avoids repeated handshake overhead."
- full: "Pool reuse open DB connections. No new connection per request. Skip handshake overhead."
- ultra: "Pool = reuse DB conn. Skip handshake → fast under load."

## Auto-Clarity

Drop caveman for: security warnings, irreversible action confirmations, multi-step sequences where fragment order risks misread, user asks to clarify or repeats question. Resume caveman after clear part done.

Example — destructive op:
> **Warning:** This will permanently delete all rows in the \`users\` table and cannot be undone.
> \`\`\`sql
> DROP TABLE users;
> \`\`\`
> Caveman resume. Verify backup exist first.

## Boundaries

Code/commits/PRs: write normal. "stop caveman" or "normal mode": revert. Level persist until changed or session end.`;

/**
 * 生成 Caveman 简洁模式的 System Prompt 部分
 * 使用与 skill 注入一致的 <activated_skill> 标签格式，只注入选定模式的内容
 * @param mode 当前的 Caveman 模式
 * @returns 包裹在 <activated_skill> 标签中的 instruction，或空字符串
 */
export function generateCavemanPromptSection(mode: CavemanMode): string {
  if (mode === 'off') {
    return '';
  }

  return `<activated_skill name="caveman">
<instructions>
${CAVEMAN_PROMPT}

**Current active level: ${mode}**
</instructions>
</activated_skill>`;
}

/**
 * 生成 Skills 部分的 System Prompt
 * 参考: https://github.com/cline/cline/blob/main/src/core/prompts/system-prompt/components/skills.ts
 */
export function generateSkillsPromptSection(skills: SkillIndexItem[]): string {
  if (skills.length === 0) {
    return '';
  }

  const skillsList = skills
    .map(skill => `  - "${skill.name}": ${skill.description}`)
    .join('\n');

  return `<skills>
The following skills provide specialized instructions for specific tasks. When a user's request matches a skill description, use the use_skill tool to load and activate the skill.

Available skills:
${skillsList}

To use a skill:
1. Match the user's request to a skill based on its description
2. Call use_skill with the skill_name parameter set to one or more exact skill names
3. You can activate multiple skills at once by passing an array of skill names (e.g., ["skill1", "skill2"])
4. Follow the instructions returned by the tool
</skills>`;
}