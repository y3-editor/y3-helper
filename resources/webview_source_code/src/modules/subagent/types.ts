/**
 * Subagent 模块类型定义
 *
 * 定义 Agent 注册表、Runner 运行时状态、任务参数和结果等核心类型。
 */

import { ToolCall } from '../../services';
import type { AssociationProperties, ConversationRoundState } from '../../telemetry/otel';
import type { Context } from '../../telemetry/otel';
import type { SafeSpan } from '../../telemetry/otel';

// ============================================================
// Agent 定义
// ============================================================

/**
 * Agent 专属 MCP server 配置项。
 * 格式兼容 Claude claude.ai 的 mcpServers 字段配置。
 */
export interface AgentMCPServerConfig {
  /** stdio 类型：启动命令（如 "npx"、"python"） */
  command?: string;
  /** stdio 类型：命令参数列表 */
  args?: string[];
  /** 环境变量（Record<string, string> 格式，兼容 Claude claude.ai） */
  env?: Record<string, string>;
  /** sse / streamableHttp 类型：服务器地址 */
  url?: string;
  /** server 类型，默认为 stdio */
  type?: 'stdio' | 'sse' | 'streamableHttp';
  /** 连接超时（毫秒） */
  timeout?: number;
  /** HTTP headers（sse / streamableHttp 类型） */
  headers?: Record<string, string>;
}

/** Agent 定义：描述一个子代理的能力和约束 */
export interface Agent {
  /** 唯一标识名称 */
  name: string;
  /** 功能描述，用于主模型选择 Agent */
  description: string;
  /** 子代理的 system prompt */
  prompt: string;
  /** 允许使用的工具白名单（可选；未指定则不限制） */
  tools?: string[];
  /** 禁止使用的工具黑名单（可选） */
  disallowedTools?: string[];
  /** 自定义使用的模型（可选，不指定则使用当前默认模型） */
  model?: string;
  /** 最大执行步数（可选；未指定则使用默认值） */
  maxSteps?: number;
  /** Agent 来源：builtin 为内置，custom 为 IDE 加载的用户自定义 */
  source?: 'builtin' | 'custom';
  /** 自定义 Agent 的文件路径（绝对路径） */
  path?: string;
  /** 存储范围：project 为项目级，user 为个人级 */
  scope?: 'project' | 'user';
  /**
   * Agent 专属 MCP server 配置（格式兼容 Claude claude.ai mcpServers 字段）。
   *
   * - 未指定时：Subagent 使用全局所有已连接的 MCP servers（默认行为）
   * - 指定时：Subagent 执行前向 IDE 请求启动这些专属 servers，执行结束后自动清理
   *
   * key 为 server 的逻辑名称（如 "filesystem"、"github"），
   * 实际注册到 IDE 时会自动添加隔离前缀，避免并发冲突。
   */
  mcpServers?: Record<string, AgentMCPServerConfig>;
  /**
   * 运行时加载状态 — 不持久化到文件。
   * IDE 解析 agent.md 失败时置为 "error"，webview 据此禁用该 agent。
   */
  _status?: 'success' | 'error';
  /** 解析失败时的错误信息，仅 _status === "error" 时有效 */
  _msg?: string;
}

// ============================================================
// Runner 运行时状态
// ============================================================

/** 待处理的工具调用，包含超时控制 */
export interface PendingToolCall {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  toolName: string;
  startTime: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

/** 子代理运行时状态 */
export interface SubagentRunnerState {
  /** 子会话 ID（即 task_id） */
  taskId: string;
  /** 使用的 Agent 名称 */
  agentName: string;
  /** 用于中止子代理 LLM 调用的 AbortController */
  abortController: AbortController;
  /** 工具调用等待状态，key 为 tool_id */
  pendingToolResults: Map<string, PendingToolCall>;
  /** 父会话 ID，用于按主会话终止所有子代理 */
  parentSessionId: string;
}

// ============================================================
// Task 工具参数与结果
// ============================================================

/** task 工具的调用参数 */
export interface TaskParams {
  /** 任务的简短描述 */
  description: string;
  /** 完整的任务提示 */
  prompt: string;
  /** 目标 Agent 名称 */
  subagent_type: string;
}

/** task 工具的返回结果 */
export interface TaskResult {
  /** 子会话 ID */
  taskId: string;
  /** 格式化后的结果文本（包含 task_id 和 <task_result> 标签） */
  output: string;
  /** 是否成功完成 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
  /** 是否被用户中止 */
  isAborted?: boolean;
  /** 是否因达到 maxSteps 被强制截断 */
  isTruncated?: boolean;
  /** 执行的 agent 名称 */
  agentName?: string;
  /** 任务描述 */
  description?: string;
}

// ============================================================
// 子代理调用上下文
// ============================================================

/** 子代理调用上下文，合并所有外部传入的元信息 */
export interface RunSubagentContext {
  /** 父会话 ID */
  parentSessionId: string;
  /** 父 agent 的 AbortSignal，用于级联终止 */
  parentAbortSignal?: AbortSignal;
  /** 主会话中 tool_call 的 ID，作为 UI 状态的主键 */
  toolCallId: string;
  /** 主 agent 的 ConversationRound 状态，用于 tracing context 传递 */
  round?: ConversationRoundState;
}

// ============================================================
// LLM 调用相关
// ============================================================

/** LLM 调用的 token 用量统计 */
export interface LLMCallUsage {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

/** LLM 调用结果 */
export interface LLMCallResult {
  text: string;
  toolCalls: ToolCall[]
  usage: LLMCallUsage;
  /** Gemini 模型的 thinking_signature，用于后续请求的签名验证 */
  thinkingSignature?: string;
}

// ============================================================
// 错误分类
// ============================================================

/**
 * 错误严重性分类。
 * - Transient: 瞬态错误，可自动重试（网络超时、rate limit 等）
 * - Recoverable: 可恢复错误，但不自动重试（token limit 等）
 * - Fatal: 致命错误，立即抛出
 */
export enum ErrorSeverity {
  Transient = 'transient',
  Recoverable = 'recoverable',
  Fatal = 'fatal',
}

// ============================================================
// UI 可观测状态
// ============================================================

export type SubagentStatus =
  | 'pending'
  | 'running'
  | 'waiting_tool'
  | 'completed'
  | 'failed'
  | 'aborted';

/** 单次工具调用的记录 */
export interface SubagentToolCall {
  /** 工具调用 ID（toolCall.id） */
  toolCallId: string;
  /** 工具名称（toolCall.function.name） */
  toolName: string;
  /** 发送 TOOL_CALL PostMessage 的时间戳 */
  startTime: number;
  /** 收到 TOOL_CALL_RESULT 的时间戳（等待中为 undefined） */
  endTime?: number;
}

/** 子代理 UI 可观测状态信息 */
export interface SubagentStatusInfo {
  /** 子会话 ID（后端 session _id） */
  taskId: string;
  /** 父会话 ID，用于按主会话过滤状态（解决跨 session 污染问题） */
  parentSessionId: string;
  /** 使用的 Agent 名称 */
  agentName: string;
  /** 当前步数 */
  step: number;
  /** 最大步数 */
  maxSteps: number;
  /** 当前状态 */
  status: SubagentStatus;
  /** 任务描述 */
  description: string;
  /** 使用的模型名称 */
  model?: string;
  /** Runner 启动时间戳 */
  startTime?: number;
  /** Runner 结束时间戳 */
  endTime?: number;
  /** 工具调用记录数组 */
  toolCalls?: SubagentToolCall[];
  /** 错误信息（failed 状态时） */
  errorMessage?: string;
}

// ============================================================
// Subagent Session 数据结构
// ============================================================

import type { ChatMessage } from '../../services';
import type { ChatModel } from '../../services/chatModel';
import type { ConsumedTokens } from '../../utils/consumedTokensCalculator';
import type { SessionCompressionState } from '../../types/contextCompression';

/**
 * Subagent Session - 子代理会话完整数据结构
 * 
 * 参考主 agent 的 ChatSession 结构,存储子代理的完整会话状态。
 * Store 中使用 Map<taskId, SubagentSession> 缓存所有子会话。
 */
export interface SubagentSession {
  /** 会话唯一标识 (即 taskId) */
  _id: string;
  /** 使用的 agent 名称 (如 "explore", "general") */
  agentName: string;
  /** 任务描述 */
  description: string;
  /** 当前状态 */
  status: SubagentStatus;
  /** 完整的对话消息数组 */
  messages: ChatMessage[];
  /** 元数据 */
  metadata?: {
    create_time: string;
    update_time: string;
  };
  /** Token 消耗统计 */
  consumedTokens?: ConsumedTokens;
  /** 使用的模型名称 */
  model?: ChatModel;
  /** 上下文压缩状态 */
  compression?: SessionCompressionState;
  /** 压缩进行状态 */
  compressionInProgress?: boolean;
  /** 父会话 ID */
  parentSessionId?: string;
  /** 错误信息（执行失败时） */
  error?: string;
}

/**
 * 持久化到 localStorage 的元数据结构
 * 
 * 仅包含关键字段,完整 messages 不持久化以节省存储空间。
 */
export interface SubagentSessionMetadata {
  _id: string;
  agentName: string;
  description: string;
  status: SubagentStatus;
  metadata?: {
    create_time: string;
    update_time: string;
  };
  parentSessionId?: string;
}

// ============================================================
// 事件类型 (标记为废弃,将在后续版本移除)
// ============================================================

/**
 * @deprecated 事件机制已废弃,改用 Store 架构。将在后续版本移除。
 */
export type SubagentEventType =
  | 'status_change'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'timeout';

/**
 * @deprecated 事件机制已废弃,改用 Store 架构。将在后续版本移除。
 */
export interface SubagentEvent {
  /** 事件类型 */
  type: SubagentEventType;
  /** 关联的子代理任务 ID */
  taskId: string;
  /** 事件发生时间戳（毫秒） */
  timestamp: number;
  /** 事件负载数据 */
  payload?: Record<string, any>;
}


/** 按 Agent 类型分组的统计信息 - 和主 agent 保持一致的完整结构 */
export interface SubagentAgentStats {
  /** 输入token总数 */
  input: number;
  /** 输出token总数 */
  output: number;
  /** 系统提示token数 */
  systemTokens: number;
  /** 系统工具token数 */
  systemToolTokens: number;
  /** prompt token数（详细分类） */
  promptTokens: number;
  /** completion token数（详细分类） */
  completionTokens: number;
  /** 压缩prompt token数 */
  comporessPromptTokens: number;
  /** 压缩completion token数 */
  comporessCompletionTokens: number;
  /** 缓存读取token数 */
  readCacheTokens: number;
  /** 技能相关token数 */
  skillTokens: number;
  /** 规则相关token数 */
  ruleTokens: number;
  /** MCP相关token数 */
  mcpTokens: number;
  /** 缓存创建输入token数 */
  cacheCreationInputTokens: number;
  /** 缓存读取输入token数 */
  cacheReadInputTokens: number;
  /** 输入成本 */
  inputCost: number;
  /** 输出成本 */
  outputCost: number;
  /** 调用次数 */
  callCount: number;
}

/** 最近任务样本（调试用） */
export interface SubagentTaskSample {
  taskId: string;
  agent: string;
  promptTokens: number;
  completionTokens: number;
  systemTokens: number;
  totalTokens: number;
  timestamp: number;
  description: string;
}

/** Subagent Token 独立统计，挂载在 ConsumedTokens.subagentTokens 下 - 和主 agent 保持一致 */
export interface SubagentTokens {
  /** 输入token总数 */
  input: number;
  /** 输出token总数 */
  output: number;
  /** 系统提示token数 */
  systemTokens: number;
  /** 系统工具token数 */
  systemToolTokens: number;
  /** prompt token数（详细分类） */
  promptTokens: number;
  /** completion token数（详细分类） */
  completionTokens: number;
  /** 压缩prompt token数 */
  comporessPromptTokens: number;
  /** 压缩completion token数 */
  comporessCompletionTokens: number;
  /** 缓存读取token数 */
  readCacheTokens: number;
  /** 技能相关token数 */
  skillTokens: number;
  /** 规则相关token数 */
  ruleTokens: number;
  /** MCP相关token数 */
  mcpTokens: number;
  /** 输入成本 */
  inputCost: number;
  /** 输出成本 */
  outputCost: number;
  /** 总token数（便于统计） */
  total: number;
  /** 按Agent类型分组的详细统计 */
  byAgent: Record<string, SubagentAgentStats>;
  /** 最近任务样本 */
  recentTasks?: SubagentTaskSample[];
}

// ============================================================
// OpenTelemetry 追踪相关
// ============================================================

/** Subagent Span 上下文，包含 Task span 和 context 用于子 span 继承 */
export interface SubagentSpanContext {
  /** Task span（{agent_name}.agent） */
  taskSpan: SafeSpan;
  /** Task context，用于创建子 span（LLM、ToolCall、Compression） */
  taskContext: Context;
  /** Association properties（包含 agentType 和 agentName） */
  association?: AssociationProperties;
}