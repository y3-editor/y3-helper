import { create } from 'zustand';

interface AgentPromptRunner {
  name: string;
  description?: string;
}

interface AgentPromptStore {
  runner: AgentPromptRunner | null;
  setRunner: (runner: AgentPromptRunner) => void;
  clear: () => void;
}

export const useAgentPromptStore = create<AgentPromptStore>((set) => ({
  runner: null,
  setRunner: (runner) => set({ runner }),
  clear: () => set({ runner: null }),
}));