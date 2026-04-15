import { create } from 'zustand';
import { UserConfig } from '../services/user-config';

interface ChatConfigStore {
  config?: UserConfig;
  update: (config?: UserConfig) => void;
  clickInstruction? : boolean;
  setClickInstruction: (clickInstruction: boolean) => void;
}

export const useUserConfig = create<ChatConfigStore>()((set) => ({
  config: undefined,
  update: (latestConfig) => {
    set(() => ({ config: latestConfig }));
  },
  clickInstruction: false,
  setClickInstruction: (clickInstruction) => {
    set(() => ({ clickInstruction }));
  }
}));
