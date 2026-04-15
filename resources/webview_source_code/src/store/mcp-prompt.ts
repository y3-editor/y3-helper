import { create } from 'zustand';

export type McpPromptArg = {
  name: string;
  description?: string;
  required?: boolean;
};

export type McpPromptRunner = {
  serverName: string;
  promptName: string;
  title?: string;
  arguments?: McpPromptArg[];
};

type McpPromptStore = {
  // 待填写参数的 runner（控制表单显示）
  pendingRunner?: McpPromptRunner;
  // 已确认、等待发送的 runner（控制 Runner Tag 显示）
  runner?: McpPromptRunner;
  // 表单参数
  runnerArgs: Record<string, unknown>;
  // 运行后得到的文本结果，发送时使用
  resultText?: string;
  setPendingRunner: (runner?: McpPromptRunner) => void;
  setConfirmedRunner: (runner: McpPromptRunner, resultText: string) => void;
  setRunnerArgs: (args: Record<string, unknown>) => void;
  reset: () => void;
};

export const useMcpPromptApp = create<McpPromptStore>()((set) => ({
  pendingRunner: undefined,
  runner: undefined,
  runnerArgs: {},
  resultText: undefined,
  setPendingRunner: (runner) => {
    const defaults: Record<string, unknown> = {};
    if (runner?.arguments?.length) {
      for (const arg of runner.arguments) {
        defaults[arg.name] = '';
      }
    }
    set(() => ({ pendingRunner: runner, runnerArgs: defaults }));
  },
  setConfirmedRunner: (runner, resultText) => set(() => ({ runner, resultText, pendingRunner: undefined })),
  setRunnerArgs: (args) => set(() => ({ runnerArgs: args })),
  reset: () => set(() => ({ pendingRunner: undefined, runner: undefined, runnerArgs: {}, resultText: undefined })),
}));
