import { create } from 'zustand';
import { PluginAppRunner } from '../services/plugin';

interface ChatPluginAppShortcutStore {
  runner?: PluginAppRunner;
  update: (shortcut?: PluginAppRunner) => void;
  runnerExtends?: Record<string, unknown>;
  updateRunnerExtends?: (runnerExtends: Record<string, unknown>) => void;
}

export const usePluginApp = create<ChatPluginAppShortcutStore>()((set) => ({
  runner: undefined,
  runnerExtends: {},
  update: (latestConfig) => {
    set(() => ({ runner: latestConfig }));

    if (latestConfig?.app_shortcut?.params?.length) {
      const newRunnerExtends: Record<string, unknown> = {};
      latestConfig.app_shortcut?.params?.forEach((param) => {
        newRunnerExtends[param.id] = param.default_value || '';
      });
      set(() => ({ runnerExtends: newRunnerExtends }));
    } else {
      set(() => ({ runnerExtends: {} }));
    }
  },
  updateRunnerExtends: (runnerExtends) => {
    set(() => ({ runnerExtends }));
  },
}));
