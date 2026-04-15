import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CHAT_MODELS_MAP, ChatModel, IChatModelConfig } from '../services/chatModel';

export const CHAT_MAX_TOKENS = 8192;
export const CHAT_MIN_TOKENS = 4096;

export enum GptBackendService {
  Azure = 'azure',
}

export enum NetworkChatModel {
  Minimax65s = 'abab6.5s-chat',
  DouBao = 'doubao-pro-32k-browsing-240828',
  Gemini = 'gemini-2.0-flash-exp',
}

export enum ChatModelSupplyChannel {
  DEEPSEEK = 'deepseek',
  QWEN = 'qwen',
  GPT = 'gpt',
  GEMINI = 'gemini',
  CLAUDE = 'claude',
  KIMI = 'kimi',
}

// TODO: 兼容老会话为百川的情况，后续不需要可以删除
export const BAI_CHUAN = 'baichuan2' as ChatModel;


export const getAIGWModel = (model: ChatModel) => {
  return (useChatConfig.getState().chatModels[model]?.useModel || model) as ChatModel
}

export const getModelSupplyChannel = (model: ChatModel) => {
  return (useChatConfig.getState().chatModels[model]?.supplyChannel?.toLocaleLowerCase?.()) as ChatModelSupplyChannel
}

export interface ChatConfig {
  backend: GptBackendService;
  model: IChatModelConfig['code'];
  // ref: https://platform.openai.com/docs/api-reference/chat/create#chat-create-max_tokens
  max_tokens: number;
  // ref: https://platform.openai.com/docs/api-reference/chat/create#chat-create-temperature
  temperature: number; // [0,2]
  // ref: https://platform.openai.com/docs/api-reference/chat/create#chat-create-presence_penalty
  presence_penalty: number; // [-2,2]
  // gpt4 api key: <AppID>.<AppKey>
  app_id?: string;
  app_key?: string;
}

export type ModelMaxTokenType = Record<IChatModelConfig['code'], number>;

const DEFAULT_CONFIG: ChatConfig = {
  backend: GptBackendService.Azure,
  model: '' as ChatModel,
  max_tokens: CHAT_MIN_TOKENS,
  temperature: 0.7,
  presence_penalty: 0,
};

const MODEL_MAX_TOKENS_MAP = (Object.keys(CHAT_MODELS_MAP))
  .reduce(
    (
      acc: { [key in ChatModel]: number },
      modelName: string,
    ) => {
      const modelConfig = CHAT_MODELS_MAP[modelName as ChatModel] as IChatModelConfig
      if (modelConfig) {
        acc[modelName as ChatModel] = modelConfig.tokenInfo.maxTokens
      }
      return acc;
    },
    {} as { [key in ChatModel]: number },
  );

const CODEBASE_MODEL_MAX_TOKENS_MAP = (Object.keys(CHAT_MODELS_MAP))
  .reduce(
    (
      acc: { [key in ChatModel]: number },
      modelName: string,
    ) => {
      const modelConfig = CHAT_MODELS_MAP[modelName as ChatModel] as IChatModelConfig
      if (modelConfig) {
        acc[modelName as ChatModel] = modelConfig.tokenInfo.maxTokensInCodebase
      }
      return acc;
    },
    {} as { [key in ChatModel]: number },
  );

interface ChatConfigStore {
  config: ChatConfig;
  update: (updater: (config: ChatConfig) => void) => void;
  modelMaxToken: ModelMaxTokenType;
  codebaseModelMaxTokens: ModelMaxTokenType;
  updateModelMaxToken: (chatMaxToken: ModelMaxTokenType) => void;
  updateCodebaseModelMaxToken: (chatMaxToken: ModelMaxTokenType) => void;
  planModeButtonEnabled: boolean;
  setPlanModeButtonEnabled: (planModeButtonEnabled: boolean) => void;
  chatModels: Record<string, IChatModelConfig>,
  setChatModels: (models: Record<string, IChatModelConfig>) => void;

  /** 分别存储普通聊天和仓库智聊的模型 */
  normalChatModel: IChatModelConfig['code'];
  codebaseChatModel: IChatModelConfig['code'];
  setNormalChatModel: (model: IChatModelConfig['code']) => void;
  setCodebaseChatModel: (model: IChatModelConfig['code']) => void;

  /** 仓库智聊 开启自动运行配置 Start */
  autoApprove: boolean;
  updateAutoApprove: (autoApprove: boolean) => void;
  autoApply: boolean;
  updateAutoApply: (autoApply: boolean) => void;
  autoExecute: boolean;
  updateAutoExecute: (autoExecute: boolean) => void;
  autoTodo: boolean;
  updateAutoTodo: (autoTodo: boolean) => void;
  autoPlanApprove: boolean;
  updateAutoPlanApprove: (autoPlanApprove: boolean) => void;
  /** 仓库智聊 开启自动运行配置 End */

  /** 仓库智聊 特殊工具启用 Start */
  enableEditableMode: boolean;
  setEnableEditableMode: (enable: boolean) => void;
  enableCodeMapSearch: boolean; // 代码地图检索
  setEnableCodeMapSearch: (enableCodeSearch: boolean) => void;
  enableKnowledgeLibSearch: boolean; // 知识库检索
  setEnableKnowledgeLibSearch: (enableKnowledgeLibSearch: boolean) => void;
  enableUserQuestion: boolean; // 用户提问工具
  setEnableUserQuestion: (enableUserQuestion: boolean) => void;
  enableDevspaceConfig: boolean; // DevSpace 工具
  setEnableDevspaceConfig: (enableDevspaceConfig: boolean) => void;

  compressConfig: {
    enable: boolean;
    visible: boolean;
  }
  setMemoryConfig: (config: { enable?: boolean; visible?: boolean }) => void;

  enableSkills: boolean;
  setEnableSkills: (enable: boolean) => void;
  /** 仓库智聊 特殊工具启用 End */
}

export const useChatConfig = create<ChatConfigStore>()(
  persist(
    (set, get) => ({
      enableEditableMode: true,
      config: DEFAULT_CONFIG,
      modelMaxToken: MODEL_MAX_TOKENS_MAP,
      codebaseModelMaxTokens: CODEBASE_MODEL_MAX_TOKENS_MAP,
      chatModels: CHAT_MODELS_MAP,
      setChatModels: (models: Record<string, IChatModelConfig>) => {
        set(() => ({ chatModels: models }));
      },

      // 分别存储普通聊天和仓库智聊的默认模型
      normalChatModel: '' as IChatModelConfig['code'],
      codebaseChatModel: '' as IChatModelConfig['code'],
      setNormalChatModel: (model: IChatModelConfig['code']) => {
        set(() => ({ normalChatModel: model }));
      },
      setCodebaseChatModel: (model: IChatModelConfig['code']) => {
        set(() => ({ codebaseChatModel: model }));
      },

      update: (updater) => {
        const config = get().config;
        updater(config);
        set(() => ({ config }));
      },
      updateModelMaxToken: (modelMaxToken) => {
        set(() => ({ modelMaxToken }));
      },
      updateCodebaseModelMaxToken: (modelMaxToken) => {
        set(() => ({ codebaseModelMaxTokens: modelMaxToken }));
      },
      setEnableEditableMode: (enable) => {
        set(() => ({
          enableEditableMode: enable
        }))
      },
      planModeButtonEnabled: false,
      setPlanModeButtonEnabled(planModeButtonEnabled) {
        set(() => ({
          planModeButtonEnabled,
        }))
      },
      autoApply: true,
      updateAutoApply: (autoApply: boolean) => {
        set(() => ({
          autoApply: autoApply
        }))
      },
      enableUserQuestion: true,
      setEnableUserQuestion: (enableUserQuestion: boolean) => {
        set(() => ({
          enableUserQuestion: enableUserQuestion
        }))
      },
      autoApprove: true,
      updateAutoApprove: (autoApprove: boolean) => {
        set(() => ({
          autoApprove: autoApprove
        }))
      },
      autoExecute: true,
      updateAutoExecute: (autoExecute: boolean) => {
        set(() => ({
          autoExecute: autoExecute
        }))
      },
      autoTodo: true,
      updateAutoTodo: (autoTodo: boolean) => {
        set(() => ({
          autoTodo: autoTodo
        }))
      },
      autoPlanApprove: false,
      updateAutoPlanApprove: (autoPlanApprove: boolean) => {
        set(() => ({
          autoPlanApprove: autoPlanApprove
        }))
      },
      enableCodeMapSearch: true,
      setEnableCodeMapSearch: (enable: boolean) => {
        set(() => ({
          enableCodeMapSearch: enable
        }))
      },
      enableKnowledgeLibSearch: true,
      setEnableKnowledgeLibSearch: (enable: boolean) => {
        set(() => ({
          enableKnowledgeLibSearch: enable
        }))
      },
      compressConfig: {
        enable: true,
        visible: false,
      },
      setMemoryConfig: (config: { enable?: boolean; visible?: boolean }) => {
        const current = get().compressConfig;
        set(() => ({
          compressConfig: {
            ...current,
            ...config,
          }
        }))
      },
      enableSkills: true,
      setEnableSkills: (enable: boolean) => {
        set(() => ({
          enableSkills: enable
        }))
      },
      enableDevspaceConfig: true,
      setEnableDevspaceConfig: (enable: boolean) => {
        set(() => ({
          enableDevspaceConfig: enable
        }))
      },
    }),
    {
      name: 'codechat-config',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        normalChatModel: state.normalChatModel,
        codebaseChatModel: state.codebaseChatModel,
        autoTodo: state.autoTodo,
        autoApply: state.autoApply,
        autoApprove: state.autoApprove,
        autoExecute: state.autoExecute,
        enableCodeMapSearch: state.enableCodeMapSearch,
        enableKnowledgeLibSearch: state.enableKnowledgeLibSearch,
        enableEditableMode: state.enableEditableMode,
        compressConfig: state.compressConfig,
        enableSkills: state.enableSkills,
        enableUserQuestion: state.enableUserQuestion,
        enableDevspaceConfig: state.enableDevspaceConfig,
      }),
    },
  ),
);

export const MERMAID_SIGN = 'Graph';
