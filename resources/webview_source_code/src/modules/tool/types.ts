/**
 * Tool Result Processor — 类型定义
 *
 * 定义工具结果处理器的核心类型：
 * - RawToolCallResult: IDE 返回的原始工具结果
 * - ProcessedToolResult: handler 处理后的结果
 * - ProcessContext: 调用方传入的上下文
 * - ToolResultHandler: handler 接口
 */

// ============================================================
// 原始工具结果 (来自 IDE / TOOL_CALL_RESULT 事件)
// ============================================================

/**
 * 工具调用的原始结果，由 IDE 通过 postMessage 推送
 */
export interface RawToolCallResult {
  /** 工具调用 ID */
  tool_id: string;
  /** 工具名称，如 'read_file'、'edit_file' */
  tool_name: string;
  /** 工具返回的原始数据 */
  tool_result: {
    /** 工具返回的文本内容 */
    content: string;
    /** 是否为错误结果 */
    isError?: boolean;
  };
  /** 工具调用的扩展数据（可选），由各工具自行定义 */
  extra?: Record<string, any>;
  /** 所属任务 ID（Subagent 场景） */
  task_id?: string;
}

// ============================================================
// 处理后的工具结果
// ============================================================

/**
 * handler 处理后返回的工具结果
 */
export interface ProcessedToolResult {
  /** 处理后的文本内容，供 LLM 消费 */
  content: string;
  /** 文件路径（read_file / edit_file 场景） */
  path?: string;
  /** 是否为错误结果 */
  isError: boolean;
  /** 额外元数据，由各 handler 按需填充 */
  metadata?: Record<string, any>;
}

// ============================================================
// 处理上下文
// ============================================================

/**
 * 调用 processor.process() 时传入的上下文，区分调用来源并注入可选回调
 */
export interface ProcessContext {
  /**
   * 调用来源标识
   * - 'codechat': 主会话（CodeChat.tsx）
   * - 'subagent': Subagent executor
   */
  source: 'codechat' | 'subagent';

  // ---------- CodeChat 专属安全限制参数（Subagent 不传） ----------

  /**
   * 是否解除 .c/.h 文件安全限制
   * 仅在 source === 'codechat' 时有效
   */
  cUnrestrict?: boolean;

  /**
   * 是否为私有模型（影响 .c/.h 安全限制判断）
   * 仅在 source === 'codechat' 时有效
   */
  isPrivateModel?: boolean;

  /**
   * 是否允许公开模型访问（影响 retrieve_code 的 isLpc 标记）
   */
  allowPublicModelAccess?: boolean;

  // ---------- 异步回调（Subagent 不注入，CodeChat 未来按需注入） ----------

  /**
   * 文档内容解析回调（如 PDF、Word 等）
   * 存在时由 ReadFileHandler 调用，调用后 process() 返回 null
   */
  onParseDoc?: (raw: RawToolCallResult) => void;

  /**
   * 图片内容解析回调
   * 存在时由 ReadFileHandler 调用，调用后 process() 返回 null
   */
  onParseImage?: (raw: RawToolCallResult) => void;
}

// ============================================================
// Handler 接口
// ============================================================

/**
 * 工具结果处理器接口
 *
 * 每个 handler 负责处理一个或多个特定 tool_name 的结果，
 * process() 方法应为纯函数，不产生副作用（store 更新、上报等）。
 */
export interface ToolResultHandler {
  /**
   * 该 handler 负责处理的工具名称列表
   * 注册时将为每个 toolName 建立映射
   */
  toolNames: string[];

  /**
   * 处理工具结果
   *
   * @param raw - 原始工具结果
   * @param ctx - 调用上下文
   * @returns 处理后的结果；返回 null 表示已通过异步回调处理，调用方不再处理
   */
  process(
    raw: RawToolCallResult,
    ctx: ProcessContext,
  ): ProcessedToolResult | null;
}