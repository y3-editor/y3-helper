import { ToolCall } from "../../..";


export abstract class IAzureOpenAIStream {
}

export interface IAzureOpenAIStreamContext {
  content: string;
  tool_calls: ToolCall[];
  totalTokens: number;
  completionTokens: number;
  promptTokens: number;
  cacheReadInputTokens: number;
  responseId: string;
}

export interface IAIGWResponsesRequest {
  /** 模型名称 */
  model: string;
  /** 输入内容：字符串或消息对象数组 */
  input: string | Record<string, any>[];
  /** 系统指令 */
  instructions?: string;
  /** 上一次响应 ID，用于多轮对话续接 */
  previous_response_id?: string;
  /** 会话标识 */
  conversation?: string;
  /** 是否开启流式输出 */
  stream?: boolean;
  /** 采样温度 */
  temperature?: number;
  /** nucleus sampling 阈值 */
  top_p?: number;
  /** 最大输出 token 数 */
  max_output_tokens?: number;
  /** 最大工具调用次数 */
  max_tool_calls?: number;
  /** 工具列表 */
  tools?: Record<string, any>[];
  /** 工具选择策略 */
  tool_choice?: string | Record<string, any>;
  /** 是否允许并行工具调用 */
  parallel_tool_calls?: boolean;
  /** 文本格式配置 */
  text?: Record<string, any>;
  /** 推理配置（如 o1/o3 系列模型） */
  reasoning?: Record<string, any>;
  /** 响应中需包含的额外字段 */
  include?: string[];
  /** 是否开启 thinking 模式 */
  enable_thinking?: boolean;
  /** 截断策略 */
  truncation?: string;
  /** 终端用户标识 */
  user?: string;
  /** 自定义元数据 */
  metadata?: Record<string, any>;
  /** 提示词缓存 key */
  prompt_cache_key?: string;
  /** 从指定 item id 之后开始续接 */
  previous_item_id?: string;
  /** 安全标识符 */
  safety_identifier?: string;
  /** 服务等级 */
  service_tier?: string;
  /** 是否持久化存储响应 */
  store?: boolean;
  /** 返回 top logprobs 数量 */
  top_logprobs?: number;
  /** 额外扩展字段 */
  [key: string]: any;
}