import { create } from 'zustand';
import { formatSkillContent, SkillData } from './index';

export type SkillPromptRunner = {
  skillName: string;
  title: string;
  source?: string;
  loading?: boolean;
  data?: SkillData;
};

type SkillPromptStore = {
  // 改为Map存储多个active skills
  activeSkills: Map<string, SkillPromptRunner>;
  // 运行后得到的 skill 内容，发送时使用
  resultText?: string;
  // 全局加载状态（至少有一个skill在加载）
  loading: boolean;
  
  // 添加单个skill
  addSkill: (skillName: string, runner?: Partial<SkillPromptRunner>) => void;
  // 移除单个skill
  removeSkill: (skillName: string) => void;
  // 检查skill是否已激活
  hasSkill: (skillName: string) => boolean;
  // 更新skill状态
  updateSkill: (skillName: string, updates: Partial<SkillPromptRunner>) => void;
  // 设置skill数据（激活成功后调用）
  setSkillData: (skillName: string, skillData: SkillData) => void;
  
  // 兼容旧版本的单个runner模式——等待发送的 skill runner
  runner?: SkillPromptRunner;
  setRunner: (runner: SkillPromptRunner, skillData: SkillData) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
};

export const useSkillPromptApp = create<SkillPromptStore>()((set, get) => ({
  activeSkills: new Map(),
  resultText: undefined,
  loading: false,
  runner: undefined,
  
  addSkill: (skillName, runner = {}) => {
    set((state) => {
      const newMap = new Map(state.activeSkills);
      newMap.set(skillName, {
        skillName,
        title: runner.title || `/${skillName}`,
        source: runner.source,
        loading: true,
        data: runner.data,
      });
      return { activeSkills: newMap, loading: true };
    });
  },
  
  removeSkill: (skillName) => {
    set((state) => {
      const newMap = new Map(state.activeSkills);
      newMap.delete(skillName);
      
      // 更新resultText
      const allSkills = Array.from(newMap.values()).filter(s => s.data);
      const resultText = allSkills.length > 0 
        ? allSkills.map(s => formatSkillContent(s.data!)).join('\n\n---\n\n')
        : undefined;
      
      // 检查是否还有正在加载的skill
      const hasLoading = Array.from(newMap.values()).some(s => s.loading);
      
      return { 
        activeSkills: newMap, 
        resultText,
        loading: hasLoading,
      };
    });
  },
  
  hasSkill: (skillName) => {
    return get().activeSkills.has(skillName);
  },
  
  updateSkill: (skillName, updates) => {
    set((state) => {
      const newMap = new Map(state.activeSkills);
      const existing = newMap.get(skillName);
      if (existing) {
        newMap.set(skillName, { ...existing, ...updates });
      }
      
      // 检查是否还有正在加载的skill
      const hasLoading = Array.from(newMap.values()).some(s => s.loading);
      
      return { activeSkills: newMap, loading: hasLoading };
    });
  },
  
  setSkillData: (skillName, skillData) => {
    set((state) => {
      const newMap = new Map(state.activeSkills);
      const existing = newMap.get(skillName);
      if (existing) {
        newMap.set(skillName, {
          ...existing,
          data: skillData,
          loading: false,
        });
      }
      
      // 更新组合后的resultText
      const allSkills = Array.from(newMap.values()).filter(s => s.data);
      const resultText = allSkills.length > 0 
        ? allSkills.map(s => formatSkillContent(s.data!)).join('\n\n---\n\n')
        : undefined;
      
      // 检查是否还有正在加载的skill
      const hasLoading = Array.from(newMap.values()).some(s => s.loading);
      
      return { 
        activeSkills: newMap, 
        resultText,
        loading: hasLoading,
      };
    });
  },
  
  setRunner: (runner, skillData) => {
    const resultText = formatSkillContent(skillData);
    set(() => ({ 
      runner, 
      resultText, 
      loading: false,
      activeSkills: new Map([[runner.skillName, {
        ...runner,
        data: skillData,
        loading: false,
      }]]),
    }));
  },
  
  setLoading: (loading) => set(() => ({ loading })),
  
  reset: () => set(() => ({ 
    runner: undefined, 
    resultText: undefined, 
    loading: false,
    activeSkills: new Map(),
  })),
}));
