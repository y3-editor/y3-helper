import { create } from 'zustand';

export type SkillSource = 'codemaker-user' | 'codemaker-project' | 'claude-project' | 'claude-user';

export interface SkillIndexItem {
  name: string;
  description: string;
  source: SkillSource;
  userInvocable?: boolean;
}

export interface SkillResources {
  cwd: string;
  files: string[];
}

export interface SkillData {
  name: string;
  content: string;
  path: string;
  source: SkillSource;
  resources?: SkillResources;
}

export const SKILL_TOOL_ID_PREFIX = 'skill-slash-';

export function createSkillToolId(): string {
  return `${SKILL_TOOL_ID_PREFIX}${Date.now()}`;
}

export function isSkillToolId(toolId?: string): boolean {
  return Boolean(toolId && toolId.startsWith(SKILL_TOOL_ID_PREFIX));
}

export function getSkillSourceLabel(source: SkillSource): string {
  switch (source) {
    case 'claude-user':
      return '~/.claude/skills';
    case 'codemaker-user':
      return '~/.y3maker/skills';
    case 'claude-project':
      return '.claude/skills';
    case 'codemaker-project':
      return '.y3maker/skills';
    default:
      return source;
  }
}

export function parseSkillToolResult(content: string): SkillData | null {
  try {
    const data = JSON.parse(content);
    if (data && data.name && data.content && data.source) {
      return {
        name: data.name,
        content: data.content,
        path: data.path || '',
        source: data.source,
        resources: data.resources,
      };
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export function formatSkillContent(skill: SkillData): string {
  let resourcesSection = '';

  if (skill.resources && skill.resources.files.length > 0) {
    resourcesSection = `\n<resources cwd="${skill.resources.cwd}">\n${skill.resources.files.join('\n')}\n</resources>`;
  }

  return `<activated_skill name="${skill.name}">
<instructions>
${skill.content}
</instructions>${resourcesSection}
</activated_skill>`;
}

export interface SkillsStore {
  skills: SkillIndexItem[];

  setSkills: (skills: SkillIndexItem[]) => void;
}

export const useSkillsStore = create<SkillsStore>((set) => ({
  skills: [],

  setSkills: (skills) => {
    set(() => ({
      skills,
    }));
  },
}));

/**
 * 根据 skill name 获取 description
 */
export function getSkillDescription(skillName: string): string | undefined {
  const skills = useSkillsStore.getState().skills;
  const skill = skills.find(s => s.name === skillName);
  return skill?.description;
}
