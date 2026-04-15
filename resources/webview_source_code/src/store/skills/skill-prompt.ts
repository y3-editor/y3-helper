import { create } from 'zustand';
import { formatSkillContent, SkillData } from './index';

export type SkillPromptRunner = {
  skillName: string;
  title: string;
  source?: string;
};

type SkillPromptStore = {
  // 等待发送的 skill runner
  runner?: SkillPromptRunner;
  // 运行后得到的 skill 内容，发送时使用
  resultText?: string;
  // 是否正在加载 skill
  loading: boolean;
  setRunner: (runner: SkillPromptRunner, skillData: SkillData) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
};

export const useSkillPromptApp = create<SkillPromptStore>()((set) => ({
  runner: undefined,
  resultText: undefined,
  loading: false,
  setRunner: (runner, skillData) => {
    const resultText = formatSkillContent(skillData);
    set(() => ({ runner, resultText, loading: false }));
  },
  setLoading: (loading) => set(() => ({ loading })),
  reset: () => set(() => ({ runner: undefined, resultText: undefined, loading: false })),
}));
