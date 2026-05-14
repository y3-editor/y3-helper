import { create } from 'zustand';

export type SkillSource = 'codemaker-user' | 'codemaker-project' | 'claude-project' | 'claude-user' | 'agents-user' | 'agents-project' | 'builtin';

export interface SkillIndexItem {
  name: string;
  display_name?: string;
  description: string;
  description_cn?: string;
  source: SkillSource;
  userInvocable?: boolean;
  disabled?: boolean;
  hubSkillId?: string;
  installedVersion?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
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
      return '~/.codemaker/skills';
    case 'claude-project':
      return '.claude/skills';
    case 'codemaker-project':
      return '.codemaker/skills';
    case 'agents-user':
      return '~/.agents/skills';
    case 'agents-project':
      return '.agents/skills';
    case 'builtin':
      return 'built-in';
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

export interface SkillConfig {
  name: string;
  disabled: boolean;
  hubSkillId?: string;
}

export interface SkillsStore {
  skills: SkillIndexItem[];
  skillConfigs: Record<string, SkillConfig>;

  setSkills: (skills: SkillIndexItem[]) => void;
  setSkillConfig: (name: string, config: Partial<SkillConfig>) => void;
  isSkillEnabled: (name: string) => boolean;
  /** 判断某个 Hub Skill 是否已安装 */
  isHubSkillInstalled: (hubSkillId: string) => boolean;
}

export const useSkillsStore = create<SkillsStore>((set, get) => ({
  skills: [],
  skillConfigs: {},

  setSkills: (skills) => {
    set((state) => {
      // 以新的 skills 列表为准，清理已卸载 skill 的旧 config
      const activeNames = new Set(skills.map((s) => s.name));
      const updatedConfigs: Record<string, SkillConfig> = {};
      const newSkillDefaultEnabled = localStorage.getItem('new-skill-default-enabled') !== 'false';

      skills.forEach((skill) => {
        const existing = state.skillConfigs[skill.name];
        updatedConfigs[skill.name] = {
          name: skill.name,
          disabled: skill.disabled ?? existing?.disabled ?? (!existing ? !newSkillDefaultEnabled : false),
        };
      });

      // 保留仍存在的 skill 的其他配置字段，剔除已卸载的 key
      Object.keys(state.skillConfigs).forEach((name) => {
        if (activeNames.has(name) && updatedConfigs[name]) {
          updatedConfigs[name] = {
            ...updatedConfigs[name],
            ...state.skillConfigs[name],
            disabled: updatedConfigs[name].disabled,
          };
        }
      });

      return { skills, skillConfigs: updatedConfigs };
    });
  },

  setSkillConfig: (name, config) => {
    set((state) => {
      const existing = state.skillConfigs[name] ?? { name, disabled: false };
      return {
        skillConfigs: {
          ...state.skillConfigs,
          [name]: { ...existing, ...config },
        },
      };
    });
  },

  isSkillEnabled: (name) => {
    const config = get().skillConfigs[name];
    return !config?.disabled;
  },

  isHubSkillInstalled: (hubSkillId) => {
    return get().skills.some((skill) => skill.hubSkillId === hubSkillId);
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