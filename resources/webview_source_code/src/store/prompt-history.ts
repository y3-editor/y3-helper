import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PrePromptsStore {
  prePrompts: string[];
  setPrePrompts: (prompt: string) => void;
}

export const usePrePromptsStore = create(
  persist<PrePromptsStore>(
    (set, get) => ({
      prePrompts: [],
      setPrePrompts: (prompt: string) => {
        const prePrompts = get().prePrompts;
        set(() => ({
          prePrompts: prePrompts.concat(prompt),
        }));
      },
    }),
    {
      name: 'pre-prompts',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
