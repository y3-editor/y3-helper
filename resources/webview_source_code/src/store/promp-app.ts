import { create } from 'zustand';
import { UnionType } from '../routes/CodeChat/ChatTypeAhead/Prompt/type';
import { Prompt } from '../services/prompt';

interface PromptStore {
  name: string;
  description?: string;
  type: UnionType.Prompt;
  meta: Prompt;
  _id?: string;
}
interface ChatPromptAppShortcutStore {
  runner?: PromptStore;
  update: (shortcut?: PromptStore) => void;
  reset: (shortcut?: PromptStore) => void;
}

export const usePromptApp = create<ChatPromptAppShortcutStore>()((set) => ({
  runner: undefined,
  update: (latestConfig) => {
    set(() => ({ runner: latestConfig }));
  },
  reset: () => {
    set(() => ({ runner: undefined }));
  },
}));
