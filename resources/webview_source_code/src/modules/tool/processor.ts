/**
 * Tool Result Processor — 核心注册表与分发器
 *
 * 采用注册表模式（Strategy Pattern），按 tool_name 将工具结果分发到对应
 * ToolResultHandler 处理，未匹配时回退到 DefaultHandler。
 */

import type {
  RawToolCallResult,
  ProcessedToolResult,
  ProcessContext,
  ToolResultHandler,
} from './types';

export class ToolResultProcessor {
  /** tool_name → handler 映射表 */
  private readonly registry = new Map<string, ToolResultHandler>();

  /** 默认 handler（兜底截断），在 handlers/index.ts 注册后设置 */
  private defaultHandler: ToolResultHandler | null = null;

  /**
   * 注册一个 handler
   *
   * @param handler - 实现 ToolResultHandler 接口的处理器
   */
  register(handler: ToolResultHandler): void {
    // 第一个注册的 handler 若 toolNames 为空，则视为 DefaultHandler 的占位，
    // 但我们通过 setDefaultHandler 显式设置，这里仅处理具名注册。
    for (const name of handler.toolNames) {
      this.registry.set(name, handler);
    }
  }

  /**
   * 设置默认兜底 handler（当 tool_name 在 registry 中不存在时使用）
   */
  setDefaultHandler(handler: ToolResultHandler): void {
    this.defaultHandler = handler;
  }

  /**
   * 处理原始工具结果
   *
   * 1. 查找 registry 中是否有匹配的 handler
   * 2. 没有则使用 defaultHandler
   * 3. 调用 handler.process(raw, ctx) 并返回结果
   *
   * @param raw - IDE 返回的原始工具结果
   * @param ctx - 调用方传入的处理上下文
   * @returns ProcessedToolResult，或 null（异步回调场景）
   */
  process(
    raw: RawToolCallResult,
    ctx: ProcessContext,
  ): ProcessedToolResult | null {
    const handler = this.registry.get(raw.tool_name) ?? this.defaultHandler;

    if (!handler) {
      // 极端兜底：无任何 handler 时原样返回
      return {
        content: raw.tool_result.content,
        isError: raw.tool_result.isError ?? false,
      };
    }

    return handler.process(raw, ctx);
  }
}

/**
 * 全局单例
 *
 * 所有消费方（CodeChat、Subagent executor）统一使用此单例，
 * handler 在 `src/modules/tool/handlers/index.ts` 中注册。
 */
export const toolResultProcessor = new ToolResultProcessor();