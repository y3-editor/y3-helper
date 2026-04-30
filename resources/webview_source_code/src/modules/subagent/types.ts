/**
 * Subagent 模块类型定义
 *
 * 定义 Agent 注册表、Runner 运行时状态、任务参数和结果等核心类型。
 */

import { ToolCall } from "../../services";

// ============================================================
// Agent 定义
// ============================================================

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
  /** 可选：之前任务的 task_id，用于恢复子代理会话 */
  task_id?: string;
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
// 事件类型
// ============================================================

export type SubagentEventType =
  | 'status_change'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'timeout';

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