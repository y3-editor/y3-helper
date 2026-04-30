/**
 * Enhanced Tool Result Processor
 *
 * 抽离自 CodeChat.tsx 的 TOOL_CALL_RESULT 处理逻辑，
 * 提供统一的工具结果处理能力，支持主 agent 和 subagent 复用。
 */

export * from './types';
export * from './handlers';
export * from './processor';
export * from './utils';