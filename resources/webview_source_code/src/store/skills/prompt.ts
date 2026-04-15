import { SkillIndexItem } from './index';

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
2. Call use_skill with the skill_name parameter set to the exact skill name
3. Follow the instructions returned by the tool
</skills>`;
}
