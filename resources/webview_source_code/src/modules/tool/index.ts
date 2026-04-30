/**
 * Tool Result Processor 模块 — 统一导出入口（Facade）
 *
 * 外部消费者统一从 '@/modules/tool' 导入，不直接引用子模块路径。
 *
 * 导出内容：
 * - 类型定义（types.ts）
 * - 核心处理器类与全局单例（processor.ts）
 * - 各 handler 实现（handlers/）
 *
 * 模块加载时自动注册所有内置 handler，无需外部手动初始化。
 */

// ============================================================
// 类型导出
// ============================================================

export type {
  RawToolCallResult,
  ProcessedToolResult,
  ProcessContext,
  ToolResultHandler,
} from './types';

// ============================================================
// 核心处理器导出
// ============================================================

export { ToolResultProcessor, toolResultProcessor } from './processor';

// ============================================================
// Handler 导出
// ============================================================

export { DefaultHandler, defaultHandler } from './handlers/default';
export { ReadFileHandler, readFileHandler } from './handlers/read-file';

// ============================================================
// 模块初始化：自动注册所有内置 handler
// ============================================================

import { registerBuiltinHandlers } from './handlers';

registerBuiltinHandlers();