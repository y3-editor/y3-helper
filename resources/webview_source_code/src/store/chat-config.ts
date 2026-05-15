import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CHAT_MODELS_MAP, ChatModel, IChatModelConfig } from '../services/chatModel';
import { CavemanMode, CAVEMAN_MODES } from './skills/prompt';

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
  GLM = 'glm',
}

// TODO: 兼容老会话为百川的情况，后续不需要可以删除
export const BAI_CHUAN = 'baichuan2' as ChatModel;

const modelCacheMap = new Map<ChatModel, IChatModelConfig>();

/**
 * 获取有效的模型配置
 * - 优先从 modelCacheMap 查找（缓存中均为 enabled=true 的模型）
 * - 若不在缓存中（模型已下线），按以下优先级查找备选模型：
 *   1. 同 supplyChannel 中 displayOrder 最高的模型
 *   2. 如果没有同系列模型，选择同商业/私有类型中 displayOrder 最大的模型
 */
export const getValidChatModel = (model: ChatModel): IChatModelConfig | null => {
  // 优先从缓存获取，命中即为有效模型
  if (modelCacheMap.has(model)) {
    return modelCacheMap.get(model)!;
  }

  // 模型不在缓存中（已下线），查询原始配置获取 channel 信息
  const chatModels = useChatConfig.getState().chatModels;
  const modelConfig = chatModels[model];
  if (!modelConfig) return null;

  if (modelConfig.enabled) {
    modelCacheMap.set(model, modelConfig)
    return modelConfig
  }

  const modelList = Object.values(chatModels)
  let fallbackModel: IChatModelConfig | null = null;
  let maxDisplayOrder = -1;

  // Step 1: 尝试找同 supplyChannel 的模型
  for (const modelItem of modelList) {
    if (modelItem.supplyChannel === modelConfig.supplyChannel && modelItem.enabled && modelItem.chatType === modelConfig.chatType) {
      if (modelItem.displayOrder > maxDisplayOrder) {
        maxDisplayOrder = modelItem.displayOrder;
        fallbackModel = modelItem;
      }
    }
  }

  // Step 2: 如果没有同系列模型，选择同商业/私有类型中 displayOrder 最大的模型
  if (!fallbackModel) {
    maxDisplayOrder = -1;
    for (const modelItem of modelList) {
      if (modelItem.isPrivate === modelConfig.isPrivate && modelItem.enabled && modelItem.chatType === modelConfig.chatType) {
        if (modelItem.displayOrder > maxDisplayOrder) {
          maxDisplayOrder = modelItem.displayOrder;
          fallbackModel = modelItem;
        }
      }
    }
  }

  // 缓存找到的备选模型
  if (fallbackModel) {
    modelCacheMap.set(model, fallbackModel);
  }

  return fallbackModel;
}


export const getAIGWModel = (model: ChatModel) => {
  const validModel = getValidChatModel(model);
  // Y3Helper: fallback 到传入的 model 原值（而非写死的 DEFAULT_USAGE_MODEL），
  // 保证 VSCode 设置的 fixedModel 永远能透传到 API
  return (validModel?.useModel || model || DEFAULT_USAGE_MODEL) as ChatModel
}

/**
 * 获取可用的模型，当指定模型不在可用列表中时提供 fallback
 * @param model 目标模型（应该是实际使用的模型，即 useModel 或等效值）
 * @param fallback 当模型不可用时的备选模型，默认为 Claude4Sonnet20250514
 * @returns 可用的模型
 */
export const getAIGWModelWithFallback = (model: ChatModel, fallback?: ChatModel): ChatModel => {
  const chatModels = useChatConfig.getState().chatModels;
  const modelCodeList = []
  for (const key in chatModels) {
    const modelConfig = chatModels[key];
    if (modelConfig && modelConfig.useModel) {
      modelCodeList.push(modelConfig.useModel);
    }
  }

  // 如果找到模型配置，使用它的 useModel 或原始名称
  if (modelCodeList.includes(model)) {
    return model as ChatModel;
  }

  // 如果没有找到模型配置，使用指定的 fallback 或默认的模型
  return (fallback || ChatModel.Claude4Sonnet20250514) as ChatModel;
}

export const getModelSupplyChannel = (model: ChatModel) => {
  return (useChatConfig.getState().chatModels[model]?.supplyChannel?.toLocaleLowerCase?.()) as ChatModelSupplyChannel
}

/**
 * 通过 useModel 值反查模型配置
 * 用于 subagent 等场景，此时只有解析后的 useModel（如 "claude-opus-4-6"），需要找到对应的完整配置
 */
export const getModelConfigByUseModel = (useModel: string): IChatModelConfig | null => {
  const chatModels = useChatConfig.getState().chatModels;
  return Object.values(chatModels).find(
    (config) => config?.enabled && config.useModel === useModel,
  ) || null;
}

/**
 * 根据模型 code，在同一供应商渠道（supplyChannel）中找出性价比最高（价格最低）的模型。
 * 适用于 subagent 自动降级选模型、成本分析等场景。
 *
 * @param modelCode 目标模型的 code 值（即 IChatModelConfig.code，也是 chatModels 的 key）
 * @returns 同渠道中 promptWeight + completionWeight 最小的 enabled 模型配置，无匹配时返回 null
 */
export const getBestFastModel = (modelCode: string): IChatModelConfig | null => {
  const chatModels = useChatConfig.getState().chatModels;

  // Step 1: 通过 code（key）直接获取 supplyChannel
  const targetChannel = chatModels[modelCode]?.supplyChannel;

  if (!targetChannel) {
    return null;
  }

  // Step 2: 过滤同渠道且 enabled = true 的模型
  const candidates = Object.values(chatModels).filter(
    (config) =>
      config?.enabled &&
      config.supplyChannel === targetChannel,
  );

  if (candidates.length === 0) {
    return null;
  }

  // Step 3: 按 promptWeight + completionWeight 升序排序，取最便宜的一个
  candidates.sort(
    (a, b) =>
      (a.priceInfo.promptWeight + a.priceInfo.completionWeight) -
      (b.priceInfo.promptWeight + b.priceInfo.completionWeight),
  );

  return candidates[0];
};

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

export const DEFAULT_USAGE_MODEL = ChatModel.Claude46

const DEFAULT_CONFIG: ChatConfig = {
  backend: GptBackendService.Azure,
  model: DEFAULT_USAGE_MODEL,
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
  chatModelsLoading: boolean;
  setChatModelsLoading: (loading: boolean) => void;

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
  enableGlobSearch: boolean; // Glob 文件检索工具
  setEnableGlobSearch: (enableGlobSearch: boolean) => void;
  enableGrepSearch: boolean; // Grep 内容检索工具
  setEnableGrepSearch: (enableGrepSearch: boolean) => void;

  compressConfig: {
    enable: boolean;
    visible: boolean;
    /**
     * 压缩(Memory 工具)使用的模型。
     * - false(默认):走 Gemini3Flash,成本更低
     * - true:跟随主对话当前模型,质量更高、与主对话保持一致
     */
    useMainModel: boolean;
  }
  setMemoryConfig: (config: { enable?: boolean; visible?: boolean; useMainModel?: boolean }) => void;

  enableSkills: boolean;
  setEnableSkills: (enable: boolean) => void;

  /** Caveman 简洁模式：省略冗余词汇，精简回复 */
  cavemanMode: CavemanMode;
  setCavemanMode: (mode: CavemanMode) => void;
  enableToolResultOffload: boolean; // Tool Output 落盘（用户偏好）
  setEnableToolResultOffload: (enable: boolean) => void;

  toolResultOffloadSupported: boolean; // 插件是否支持落盘（运行时检测，不持久化）
  setToolResultOffloadSupported: (supported: boolean) => void;
  /** RTK 命令拦截开关（WebView 层配置，配合 rtkBinaryAvailable 双重守卫） */
  rtkEnabled: boolean;
  setRtkEnabled: (enabled: boolean) => void;
  /** 仓库智聊 特殊工具启用 End */

  /** 用户侧子代理开关：true 为开启，false 为关闭 */
  enableSubagent: boolean;
  setEnableSubagent: (enabled: boolean) => void;
  /** 用户侧子代理手动触发模式：true 为仅手动触发，false 为允许模型自动触发 */
  enableSubagentManualTriggerOnly: boolean;
  setEnableSubagentManualTriggerOnly: (enabled: boolean) => void;
  /** 是否已从 INIT_DATA 初始化过子代理配置，防止重复覆盖用户手动设置 */
  subagentConfigInitialized: boolean;
  initSubagentConfig: (enableSubagent: boolean, enableSubagentManualTriggerOnly: boolean) => void;

  /** 内置子代理模型配置：key = agent name，value = 模型代码（空字符串表示继承默认） */
  subagentModelConfig: Record<string, string>;
  setSubagentModelConfig: (agentName: string, model: string) => void;

  /** 各模型的 effort 配置，key 为模型 code，value 为 effort 级别 */
  selectedModelEffort: Record<string, string>;
  setSelectedModelEffort: (model: string, effort: string) => void;
}

export const useChatConfig = create<ChatConfigStore>()(
  persist(
    (set, get) => ({
      enableEditableMode: true,
      config: DEFAULT_CONFIG,
      modelMaxToken: MODEL_MAX_TOKENS_MAP,
      codebaseModelMaxTokens: MODEL_MAX_TOKENS_MAP,
      chatModels: {},
      setChatModels: (models: Record<string, IChatModelConfig>) => {
        modelCacheMap.clear();
        set(() => ({ chatModels: models }));
      },
      chatModelsLoading: false,
      setChatModelsLoading: (loading: boolean) => {
        set(() => ({ chatModelsLoading: loading }));
      },

      // 分别存储普通聊天和仓库智聊的默认模型
      normalChatModel: DEFAULT_USAGE_MODEL,
      codebaseChatModel: DEFAULT_USAGE_MODEL,
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
      autoApply: false,
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
      autoApprove: false,
      updateAutoApprove: (autoApprove: boolean) => {
        set(() => ({
          autoApprove: autoApprove
        }))
      },
      autoExecute: false,
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
        useMainModel: false,
      },
      setMemoryConfig: (config: { enable?: boolean; visible?: boolean; useMainModel?: boolean }) => {
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
      cavemanMode: 'off',
      setCavemanMode: (mode: CavemanMode) => {
        set(() => ({
          cavemanMode: mode,
        }))
      },
      rtkEnabled: false,
      setRtkEnabled: (enabled: boolean) => {
        set(() => ({
          rtkEnabled: enabled,
        }))
      },
      enableDevspaceConfig: true,
      setEnableDevspaceConfig: (enable: boolean) => {
        set(() => ({
          enableDevspaceConfig: enable
        }))
      },
      enableGlobSearch: true,
      setEnableGlobSearch: (enable: boolean) => {
        set(() => ({
          enableGlobSearch: enable
        }))
      },
      enableGrepSearch: true,
      setEnableGrepSearch: (enable: boolean) => {
        set(() => ({
          enableGrepSearch: enable
        }))
      },
      enableSubagent: true,
      setEnableSubagent: (enabled: boolean) => {
        set(() => ({ enableSubagent: enabled }));
      },
      enableSubagentManualTriggerOnly: false,
      setEnableSubagentManualTriggerOnly: (enabled: boolean) => {
        set(() => ({ enableSubagentManualTriggerOnly: enabled }));
      },
      subagentConfigInitialized: false,
      initSubagentConfig: (enableSubagent: boolean, enableSubagentManualTriggerOnly: boolean) => {
        set((state) => {
          if (state.subagentConfigInitialized) return {};
          return { enableSubagent, enableSubagentManualTriggerOnly, subagentConfigInitialized: true };
        });
      },
      subagentModelConfig: {},
      setSubagentModelConfig: (agentName: string, model: string) => {
        set((state) => ({
          subagentModelConfig: {
            ...state.subagentModelConfig,
            [agentName]: model,
          },
        }));
      },
      selectedModelEffort: {},
      setSelectedModelEffort: (model: string, effort: string) => {
        set((state) => ({
          selectedModelEffort: {
            ...state.selectedModelEffort,
            [model]: effort,
          },
        }));
      },
      enableToolResultOffload: true,
      setEnableToolResultOffload: (enable: boolean) => {
        set(() => ({
          enableToolResultOffload: enable
        }))
      },
      toolResultOffloadSupported: false,
      setToolResultOffloadSupported: (supported: boolean) => {
        set(() => ({
          toolResultOffloadSupported: supported
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
        cavemanMode: state.cavemanMode,
        rtkEnabled: state.rtkEnabled,
        enableUserQuestion: state.enableUserQuestion,
        enableDevspaceConfig: state.enableDevspaceConfig,
        enableGlobSearch: state.enableGlobSearch,
        enableGrepSearch: state.enableGrepSearch,
        subagentModelConfig: state.subagentModelConfig,
        enableSubagent: state.enableSubagent,
        enableSubagentManualTriggerOnly: state.enableSubagentManualTriggerOnly,
        subagentConfigInitialized: state.subagentConfigInitialized,
        selectedModelEffort: state.selectedModelEffort,
        enableToolResultOffload: state.enableToolResultOffload,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as object) };
        const p = persisted as Record<string, unknown> | null;
        // 兼容旧版 cavemanModeEnabled: boolean → cavemanMode: CavemanMode
        if (p && 'cavemanModeEnabled' in p && !('cavemanMode' in p)) {
          (merged as any).cavemanMode = p.cavemanModeEnabled ? 'full' : 'off';
        }
        // 校验 cavemanMode 合法性，非法值回退到 'off'
        if (!CAVEMAN_MODES.includes((merged as any).cavemanMode)) {
          (merged as any).cavemanMode = 'off';
        }
        return merged as typeof current;
      },
    },
  ),
);

export const MERMAID_SIGN = 'Graph';

if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.chatConfigStore = useChatConfig;
}