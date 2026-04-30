import { originalCodeMakerApi } from '.';

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

export interface TokenInfo {
  maxTokens: number; 
  maxTokensInCodebase: number; 
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

export interface PriceInfo {
  currency: string; 
  promptWeight: number; 
  completionWeight: number; 
  cacheWeightFor5min: number; 
  hitCacheWeight: number; 
}

// 权限配置信息
export interface AuthInfo {
  allowAll: boolean; 
  allowedUsers: string[]; 
  allowedDepartments: string[]; 
}

// 模型配置接口
export interface IChatModelConfig {
  supplyChannel?: string; 
  code: ChatModel; 
  title: string; 
  enabled: boolean; 
  icon: string; 
  chatType: ChatModelType; 
  parseImgType: ParseImgType; 
  isPrivate: boolean; 
  tags: string[];
  hasComputableToken: boolean; 
  hasTokenCache: boolean; 
  hasThinking: boolean; 
  useModel?: ChatModel; 
  peerUserContent: boolean; 
  displayOrder: number; 
  tokenInfo: TokenInfo;
  priceInfo: PriceInfo;
  authInfo: AuthInfo;
}

// getUserModels 接口响应类型
export interface IGetUserModelsResponse {
  model_configs: IChatModelConfig[];
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
  Claude46 = 'Claude 4.6 Sonnet-1772766615067',
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
}

export async function getUserModels() {
  const { data } = await originalCodeMakerApi.get('/get_user_models');
  return data;
}

export const CHAT_MODELS_MAP: Record<string, IChatModelConfig> = {
  [ChatModel.DeepseekYDV31]: {
    code: ChatModel.DeepseekYDV31,
    title: 'DeepSeek V3.1 (私)',
    isPrivate: true,
    icon: ModelIconType.DEEPSEEK,
    enabled: true,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.NONE,
    tags: ['New'],
    hasComputableToken: false,
    hasTokenCache: false,
    hasThinking: false,
    peerUserContent: true,
    displayOrder: 4,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 32000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.0012,
      completionWeight: 0.0036,
      cacheWeightFor5min: 0,
      hitCacheWeight: 0,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.DeepseekYDR1]: {
    code: ChatModel.DeepseekYDR1,
    title: 'DeepSeek R1 (私)',
    isPrivate: true,
    icon: ModelIconType.DEEPSEEK,
    enabled: true,
    chatType: ChatModelType.NORMAL,
    parseImgType: ParseImgType.NONE,
    tags: [],
    hasComputableToken: false,
    hasTokenCache: false,
    hasThinking: true,
    peerUserContent: true,
    displayOrder: 3,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 32000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0,
      completionWeight: 0,
      cacheWeightFor5min: 0,
      hitCacheWeight: 0,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.DeepseekYDR31]: {
    code: ChatModel.DeepseekYDR31,
    title: 'DeepSeek R3.1 (私)',
    isPrivate: true,
    icon: ModelIconType.DEEPSEEK,
    enabled: false,
    chatType: ChatModelType.NORMAL,
    parseImgType: ParseImgType.NONE,
    tags: [],
    hasComputableToken: false,
    hasTokenCache: false,
    hasThinking: true,
    peerUserContent: true,
    displayOrder: 3,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 32000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.0012,
      completionWeight: 0.0036,
      cacheWeightFor5min: 0,
      hitCacheWeight: 0,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.QWQPlus0306]: {
    code: ChatModel.QWQPlus0306,
    title: 'QWQ (32b)',
    isPrivate: true,
    icon: ModelIconType.QWEN,
    enabled: true,
    chatType: ChatModelType.NORMAL,
    parseImgType: ParseImgType.NONE,
    tags: [],
    hasComputableToken: false,
    hasTokenCache: false,
    hasThinking: false,
    peerUserContent: true,
    displayOrder: 2,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 32000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0,
      completionWeight: 0,
      cacheWeightFor5min: 0,
      hitCacheWeight: 0,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Claude45Opus20251101]: {
    code: ChatModel.Claude45Opus20251101,
    title: 'Claude 4.5 Opus',
    isPrivate: false,
    icon: ModelIconType.CLAUDE,
    enabled: true,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: ['New'],
    hasComputableToken: true,
    hasTokenCache: true,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 38,
    tokenInfo: {
      maxTokens: 64000, // 普通聊天Token
      maxTokensInCodebase: 72000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.036,
      completionWeight: 0.18,
      cacheWeightFor5min: 0.045,
      hitCacheWeight: 0.0036,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Claude45Opus20251101Thinking]: {
    code: ChatModel.Claude45Opus20251101Thinking,
    title: 'Claude 4.5 Opus Thinking',
    isPrivate: false,
    icon: ModelIconType.CLAUDE,
    enabled: true,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: ['New'],
    hasComputableToken: true,
    hasTokenCache: true,
    hasThinking: true,
    useModel: ChatModel.Claude45Opus20251101,
    peerUserContent: false,
    displayOrder: 37,
    tokenInfo: {
      maxTokens: 64000, // 普通聊天Token
      maxTokensInCodebase: 72000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.036,
      completionWeight: 0.18,
      cacheWeightFor5min: 0.045,
      hitCacheWeight: 0.0036,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Gemini3Pro]: {
    code: ChatModel.Gemini3Pro,
    title: 'Gemini 3 Pro',
    isPrivate: false,
    icon: ModelIconType.GEMINI,
    enabled: true,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: ['New'],
    hasComputableToken: true,
    hasTokenCache: false,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 36,
    tokenInfo: {
      maxTokens: 64000, // 普通聊天Token
      maxTokensInCodebase: 72000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.0288,
      completionWeight: 0.1296,
      cacheWeightFor5min: 0,
      hitCacheWeight: 0,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.GPT51]: {
    code: ChatModel.GPT51,
    title: 'GPT 5.1',
    enabled: true,
    isPrivate: false,
    icon: ModelIconType.GPT,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: ['New'],
    hasComputableToken: true,
    hasTokenCache: false,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 35,
    tokenInfo: {
      maxTokens: 64000, // 普通聊天Token
      maxTokensInCodebase: 64000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.009,
      completionWeight: 0.072,
      cacheWeightFor5min: 0,
      hitCacheWeight: 0,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.GPT51Codex]: {
    code: ChatModel.GPT51Codex,
    title: 'GPT 5.1 Codex',
    enabled: true,
    isPrivate: false,
    icon: ModelIconType.GPT,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: ['New'],
    hasComputableToken: true,
    hasTokenCache: false,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 34,
    tokenInfo: {
      maxTokens: 64000, // 普通聊天Token
      maxTokensInCodebase: 64000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.009,
      completionWeight: 0.072,
      cacheWeightFor5min: 0,
      hitCacheWeight: 0,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Claude45Haiku20251001]: {
    code: ChatModel.Claude45Haiku20251001,
    title: 'Claude 4.5 Haiku',
    enabled: true,
    isPrivate: false,
    icon: ModelIconType.CLAUDE,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: ['New'],
    hasComputableToken: true,
    hasTokenCache: true,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 33,
    tokenInfo: {
      maxTokens: 64000, // 普通聊天Token
      maxTokensInCodebase: 72000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.0072,
      completionWeight: 0.036,
      cacheWeightFor5min: 0.009,
      hitCacheWeight: 0.00072,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Glm46]: {
    code: ChatModel.Glm46,
    title: 'GLM 4.6',
    enabled: true,
    isPrivate: false,
    icon: ModelIconType.GLM,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.NONE,
    tags: ['New'],
    hasComputableToken: false,
    hasTokenCache: false,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 32,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 32000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.004,
      completionWeight: 0.016,
      cacheWeightFor5min: 0,
      hitCacheWeight: 0.0004,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Claude45Sonnet20250929]: {
    code: ChatModel.Claude45Sonnet20250929,
    title: 'Claude 4.5 Sonnet',
    enabled: true,
    isPrivate: false,
    icon: ModelIconType.CLAUDE,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: ['New'],
    hasComputableToken: true,
    hasTokenCache: true,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 31,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 72000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.0432,
      completionWeight: 0.162,
      cacheWeightFor5min: 0.027,
      hitCacheWeight: 0.00216,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Claude45Sonnet20250929Thinking]: {
    code: ChatModel.Claude45Sonnet20250929Thinking,
    title: 'Claude 4.5 Sonnet Thinking',
    enabled: true,
    isPrivate: false,
    icon: ModelIconType.CLAUDE,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: ['New'],
    hasComputableToken: true,
    hasTokenCache: true,
    hasThinking: true,
    useModel: ChatModel.Claude45Sonnet20250929,
    peerUserContent: false,
    displayOrder: 30,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 72000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.0432,
      completionWeight: 0.162,
      cacheWeightFor5min: 0.027,
      hitCacheWeight: 0.00216,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Claude4Opus20250514]: {
    code: ChatModel.Claude4Opus20250514,
    title: 'Claude 4 Opus',
    enabled: false,
    isPrivate: false,
    icon: ModelIconType.CLAUDE,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: [],
    hasComputableToken: true,
    hasTokenCache: true,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 29,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 72000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.108,
      completionWeight: 0.54,
      cacheWeightFor5min: 0.135,
      hitCacheWeight: 0.0108,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Claude4Opus20250514Thinking]: {
    code: ChatModel.Claude4Opus20250514Thinking,
    title: 'Claude 4 Opus Thinking',
    enabled: false,
    isPrivate: false,
    icon: ModelIconType.CLAUDE,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: [],
    hasComputableToken: true,
    hasTokenCache: true,
    hasThinking: true,
    useModel: ChatModel.Claude4Opus20250514,
    peerUserContent: false,
    displayOrder: 28,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 72000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.108,
      completionWeight: 0.54,
      cacheWeightFor5min: 0.135,
      hitCacheWeight: 0.0108,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Claude4Sonnet20250514]: {
    code: ChatModel.Claude4Sonnet20250514,
    title: 'Claude 4 Sonnet',
    enabled: true,
    isPrivate: false,
    icon: ModelIconType.CLAUDE,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: [],
    hasComputableToken: true,
    hasTokenCache: true,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 27,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 72000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.0216,
      completionWeight: 0.108,
      cacheWeightFor5min: 0.027,
      hitCacheWeight: 0.00216,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Claude4Sonnet20250514Thinking]: {
    code: ChatModel.Claude4Sonnet20250514Thinking,
    title: 'Claude 4 Sonnet Thinking',
    enabled: true,
    isPrivate: false,
    icon: ModelIconType.CLAUDE,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: [],
    hasComputableToken: true,
    hasTokenCache: true,
    hasThinking: true,
    useModel: ChatModel.Claude4Sonnet20250514,
    peerUserContent: false,
    displayOrder: 26,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 72000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.0216,
      completionWeight: 0.108,
      cacheWeightFor5min: 0.027,
      hitCacheWeight: 0.00216,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.Glm45]: {
    code: ChatModel.Glm45,
    title: 'GLM 4.5',
    enabled: true,
    isPrivate: false,
    icon: ModelIconType.GLM,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.NONE,
    tags: [],
    hasComputableToken: false,
    hasTokenCache: false,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 21,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 32000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.004,
      completionWeight: 0.016,
      cacheWeightFor5min: 0,
      hitCacheWeight: 0.0004,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.KimiK2]: {
    code: ChatModel.KimiK2,
    title: 'Kimi K2',
    enabled: true,
    isPrivate: false,
    icon: ModelIconType.KIMI,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.NONE,
    tags: [],
    hasComputableToken: false,
    hasTokenCache: false,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 20,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 32000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.004,
      completionWeight: 0.016,
      cacheWeightFor5min: 0,
      hitCacheWeight: 0,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
  [ChatModel.GPT5]: {
    code: ChatModel.GPT5,
    title: 'GPT 5',
    enabled: true,
    isPrivate: false,
    icon: ModelIconType.GPT,
    chatType: ChatModelType.ALL,
    parseImgType: ParseImgType.BASE64,
    tags: [],
    hasComputableToken: true,
    hasTokenCache: false,
    hasThinking: false,
    peerUserContent: false,
    displayOrder: 19,
    tokenInfo: {
      maxTokens: 32000, // 普通聊天Token
      maxTokensInCodebase: 32000, // 仓库聊天Token
    },
    priceInfo: {
      currency: 'CNY',
      promptWeight: 0.009,
      completionWeight: 0.072,
      cacheWeightFor5min: 0,
      hitCacheWeight: 0,
    },
    authInfo: {
      allowAll: true, // 是否允许所有人使用
      allowedUsers: [], // 允许使用的用户
      allowedDepartments: [], // 允许使用的部门列表
    },
  },
};

export async function getModelRateLimitStats() {
  const { data } = await originalCodeMakerApi.get('/rate_limit_stats');
  return data;
}

export interface ModelPriceInfo {
  currency: string;
  promptWeight: number;
  completionWeight: number;
}
