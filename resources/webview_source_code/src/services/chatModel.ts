import { originalCodeMakerApi } from ".";

// 解析图片类型
export enum ParseImgType {
  NONE,
  URL,
  BASE64,
}

export enum ChatModelType {
  ALL,
  NORMAL, // 普通聊天
  CODEBASE, // 仓库聊天
}

// TODO: 兼容老会话为百川的情况，后续不需要可以删除
export const BAI_CHUAN = 'baichuan2' as ChatModel;

export enum ModelIconType {
  QWEN = 'qwen',
  GPT = 'gpt',
  DEEPSEEK = 'deepseek',
  GEMINI = 'gemini',
  CLAUDE = 'claude',
  KIMI = 'kimi',
  GLM = 'glm',
}

// 模型配置接口
export interface IChatModelConfig {
  supplyChannel?: string; // 模型渠道
  code: ChatModel; // 模型标识
  title: string; // 前端标题
  enabled: boolean; // 是否启用
  icon: ModelIconType, // 模型展示图标
  chatType: ChatModelType; // 模型类型：0: 全部聊天 1: 普通聊天， 2: 仓库聊天
  parseImgType: ParseImgType; // 解析图片类型
  isPrivate: boolean, // 是否是私有模型
  tags: string[]; // 前端显示的标签
  hasComputableToken: boolean; // 支持实时计算Token
  hasTokenCache: boolean; // 缓存Token
  // hasNetwork: boolean; // 支持联网功能
  hasThinking: boolean; // 是否支持Thking聊天
  useModel?: string; // 使用的基础模型
  peerUserContent: boolean; // 发送消息时，消息扁平化
  displayOrder: number; // 越大前端展示越靠前
  tokenInfo: {
    maxTokens: number, // 通用token
    maxTokensInCodebase: number, // 仓库智聊中使用的Token
  },
  priceInfo: {
    currency: "CNY", // 汇率类型
    promptWeight: number; // 输入价格(每1000token费用)
    completionWeight: number; // 输出token价格
    cacheWeightFor5min: number, // 5min缓存价格
    hitCacheWeight: number, // 命中缓存价格
  },
  authInfo: {
    allowAll: boolean, // 是否允许所有人使用
    allowedUsers: string[], // 允许使用的用户
    allowedDepartments: string[], // 允许使用的部门列表
  },
}

export enum ChatModel {
  Gemini3Flash = 'gemini-3-flash',
  QWen = 'qwen2.5-coder-32b-20241126',
  QWenOld = 'qwen1.5-72b-int4-20240508',
  GPT4o = 'gpt-4o',
  GPT5 = 'gpt-5',
  GPT51 = 'gpt-5.1-2025-11-13',
  GPT51Codex = 'gpt-5.1-codex-2025-11-13',
  DEEPSEEK = 'deepseek-chat',
  DeepseekReasoner0120 = 'deepseek-reasoner',
  DeepseekReasonerDistilled0206 = 'deepseek-r1-distilled-70b-20250206',
  Gemini2 = 'gemini-2.0-flash-exp',
  QWen2 = 'qwen-max-2025-01-25',
  GPTo3 = 'o3-mini-2025-01-31',
  DeepseekReasonerPrivate0218 = 'deepseek-r1-pvt-20250218',
  QWQPlus = 'qwq-plus',
  QWQPlus0306 = 'qwen-qwq-20250306',
  Gpt4 = 'gpt-4',
  Gpt41 = 'gpt-4.1-2025-04-14',
  Gemini25 = 'gemini-2.5-pro',
  Gemini3Pro = 'gemini-3-pro',
  QWen3 = 'qwen3-235b-a22b',
  QWen3Thinking = 'qwen3-235b-a22b-thinking',
  Claude37Sonnet = 'claude-3-7-sonnet-20250219',
  Claude37SonnetThinking = 'claude-3-7-sonnet-20250219-thinking',
  Claude4Opus20250514 = 'claude-opus-4-20250514',
  Claude4Opus20250514Thinking = 'claude-opus-4-20250514-thinking',
  Claude4Sonnet20250514 = 'claude-sonnet-4-20250514',
  Claude4Sonnet20250514Thinking = 'claude-sonnet-4-20250514-thinking',
  Claude45Sonnet20250929 = 'claude-sonnet-4-5-20250929',
  Claude45Sonnet20250929Thinking = 'claude-sonnet-4-5-20250929-thinking',
  Claude45Opus20251101 = 'claude-opus-4-5-20251101',
  Claude45Opus20251101Thinking = 'claude-opus-4-5-20251101-thinking',
  KimiK2 = 'kimi-k2-0711-preview',
  DeepseekYDV3 = 'deepseek-v3-yd-latest',
  DeepseekYDR1 = 'deepseek-r1-yd-latest',
  DeepseekYDV31 = 'deepseek-v3.1-chat-yd-250821',
  DeepseekYDR31 = 'deepseek-v3.1-reasoner-yd-250821',
  Qwen3CoderPlus = 'qwen3-coder-plus',
  Glm45 = 'glm-4.5',
  Claude45Haiku20251001 = 'claude-haiku-4-5-20251001',
  Glm46 = 'glm-4.6',
  Glm47 = 'glm-4.7',
  Glm5 = 'glm-5',
  Claude46Opus = 'claude-opus-4-6'
}

export async function getUserModels() {
  const { data } = await originalCodeMakerApi.get('/get_user_models');
  return data;
}

// Y3Helper: 内置模型列表已清空，模型信息完全由用户在 VSCode Settings 中配置的 CodeMaker.CodeChatModel 提供
export const CHAT_MODELS_MAP: Record<string, IChatModelConfig> = {};
