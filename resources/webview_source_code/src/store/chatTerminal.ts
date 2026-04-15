import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ETerminalStatus } from '../routes/CodeChat/ChatMessagesList/TermialPanel';

interface IChatTerminal {
  id: string,
  status: ETerminalStatus,
}

export type ChatTerminalStore = {
  enableTerminal: boolean;
  terminals: Record<string, IChatTerminal>;
  terminalTimeout: number,
  setTerminalTimeout: (timeout: number) => void;
  setEnableTerminal: (enable: boolean) => void;
  updateTerminals: (terminalId: string, infos: IChatTerminal) => void;
};

export const useChatTerminalStore = create<ChatTerminalStore>()(
  persist(
    (set, get) => ({
      enableTerminal: true,
      terminals: {},
      terminalTimeout: 30,
      setTerminalTimeout(timeout: number) {
        set(() => ({
          terminalTimeout: timeout
        }))
      },
      setEnableTerminal(enable: boolean) {
        set(() => ({
          enableTerminal: enable
        }))
      },
      updateTerminals(terminalId: string, infos: IChatTerminal) {
        const curStatus = (get().terminals[terminalId] || '') as unknown as ETerminalStatus
        if (['Abort','Canceled','Failed','Success'].includes(curStatus)) {
          return
        }
        set((state) => {
          state.terminals[terminalId] = infos
          return state.terminals
        })
      }
    }),
    {
      name: 'codemaker-chat-terminal-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        enableTerminal: state.enableTerminal,
      }),
    },
  )
);
