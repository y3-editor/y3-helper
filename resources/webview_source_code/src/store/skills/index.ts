import { create } from 'zustand';

export type SkillSource =
  | 'y3maker-project' | 'y3maker-user'
  | 'codemaker-project' | 'codemaker-user'
  | 'claude-project' | 'claude-user'
  | 'agents-project' | 'agents-user';

export interface SkillIndexItem {
  name: string;
  display_name?: string;
  description: string;
  description_cn?: string;
  source: SkillSource;
  path?: string;
  userInvocable?: boolean;
  disabled?: boolean;
  hubSkillId?: string;
  installedVersion?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
}

export interface SkillConfig {
  name: string;
  disabled: boolean;
  hubSkillId?: string;
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
    case 'y3maker-user':
      return '~/.y3maker/skills';
    case 'y3maker-project':
      return '.y3maker/skills';
    case 'codemaker-user':
      return '~/.codemaker/skills';
    case 'codemaker-project':
      return '.codemaker/skills';
    case 'claude-user':
      return '~/.claude/skills';
    case 'claude-project':
      return '.claude/skills';
    case 'agents-user':
      return '~/.agents/skills';
    case 'agents-project':
      return '.agents/skills';
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
  skillConfigs: Record<string, SkillConfig>;

  setSkills: (skills: SkillIndexItem[]) => void;
  setSkillConfig: (name: string, config: Partial<SkillConfig>) => void;
  isSkillEnabled: (name: string) => boolean;
  isHubSkillInstalled: (hubSkillId: string) => boolean;
}

export const useSkillsStore = create<SkillsStore>((set, get) => ({
  skills: [],
  skillConfigs: {},

  setSkills: (skills) => {
    set(() => ({
      skills,
    }));
  },

  setSkillConfig: (name, config) => {
    set((state) => {
      const existing = state.skillConfigs[name];
      const merged: SkillConfig = {
        name,
        disabled: existing?.disabled ?? false,
        hubSkillId: existing?.hubSkillId,
        ...config,
      };
      merged.name = name; // name 始终以参数为准
      return {
        skillConfigs: {
          ...state.skillConfigs,
          [name]: merged,
        },
      };
    });
  },

  isSkillEnabled: (name) => {
    const config = get().skillConfigs[name];
    return !config?.disabled;
  },

  isHubSkillInstalled: (hubSkillId) => {
    const { skills } = get();
    return skills.some(s => s.hubSkillId === hubSkillId);
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