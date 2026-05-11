/**
 * Tool Result 完整性验证工具
 *
 * 用于检测并发更新导致的 tool_result 或 tool message 丢失问题
 */

import { ChatMessage } from '../services';
import { ChatRole } from '../services/useChatStream';

export interface ToolResultIntegrityReport {
  /** 是否完整 */
  isComplete: boolean;
  /** 期望的 tool_call 数量 */
  expectedCount: number;
  /** 实际的 tool_result 数量 */
  actualResultCount: number;
  /** 实际的 tool message 数量 */
  actualMessageCount: number;
  /** 缺失的 tool_result IDs */
  missingResultIds: string[];
  /** 缺失的 tool message IDs */
  missingMessageIds: string[];
  /** 完整的 tool_call 列表 */
  allToolCalls: Array<{ id: string; name: string }>;
}

/**
 * 验证 tool_result 和 tool message 的完整性
 *
 * @param messages - 消息列表
 * @param sessionId - 会话 ID（用于日志）
 * @returns 完整性报告
 */
export function validateToolResultIntegrity(
  messages: ChatMessage[],
  sessionId?: string,
): ToolResultIntegrityReport {
  // 找到最后一条 Assistant 消息
  let lastAssistantMsg: ChatMessage | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === ChatRole.Assistant && messages[i].tool_calls) {
      lastAssistantMsg = messages[i];
      break;
    }
  }

  if (!lastAssistantMsg || !lastAssistantMsg.tool_calls?.length) {
    // 没有工具调用，视为完整
    return {
      isComplete: true,
      expectedCount: 0,
      actualResultCount: 0,
      actualMessageCount: 0,
      missingResultIds: [],
      missingMessageIds: [],
      allToolCalls: [],
    };
  }

  const toolCalls = lastAssistantMsg.tool_calls;
  const toolResult = lastAssistantMsg.tool_result || {};

  // 收集 tool message
  const toolMessages = messages.filter(
    (m) => m.role === ChatRole.Tool
  );
  const toolMessageIds = new Set(toolMessages.map(m => m.tool_call_id));

  // 检查缺失
  const missingResultIds: string[] = [];
  const missingMessageIds: string[] = [];

  for (const tc of toolCalls) {
    if (!toolResult[tc.id]) {
      missingResultIds.push(tc.id);
    }
    if (!toolMessageIds.has(tc.id)) {
      missingMessageIds.push(tc.id);
    }
  }

  const isComplete =
    missingResultIds.length === 0 &&
    missingMessageIds.length === 0;

  const report: ToolResultIntegrityReport = {
    isComplete,
    expectedCount: toolCalls.length,
    actualResultCount: Object.keys(toolResult).length,
    actualMessageCount: toolMessages.length,
    missingResultIds,
    missingMessageIds,
    allToolCalls: toolCalls.map(tc => ({
      id: tc.id,
      name: tc.function.name
    })),
  };

  // 如果不完整，记录详细日志
  if (!isComplete) {
    console.error(
      `[ToolResultIntegrity] ❌ Incomplete tool results detected!`,
      {
        sessionId: sessionId || 'unknown',
        ...report,
      }
    );
  } else if (import.meta.env.DEV) {
    console.log(
      `[ToolResultIntegrity] ✅ All tool results complete`,
      {
        sessionId: sessionId || 'unknown',
        count: report.expectedCount,
      }
    );
  }

  return report;
}

/**
 * 断言 tool_result 完整性（用于测试）
 *
 * @param messages - 消息列表
 * @param sessionId - 会话 ID
 * @throws 如果不完整则抛出错误
 */
export function assertToolResultIntegrity(
  messages: ChatMessage[],
  sessionId?: string,
): void {
  const report = validateToolResultIntegrity(messages, sessionId);

  if (!report.isComplete) {
    throw new Error(
      `Tool result integrity check failed for session ${sessionId || 'unknown'}:\n` +
      `  Expected: ${report.expectedCount} tool calls\n` +
      `  Actual tool_result: ${report.actualResultCount}\n` +
      `  Actual tool messages: ${report.actualMessageCount}\n` +
      `  Missing tool_result IDs: ${report.missingResultIds.join(', ')}\n` +
      `  Missing tool message IDs: ${report.missingMessageIds.join(', ')}`
    );
  }
}

/**
 * 监控 tool_result 完整性（用于生产环境）
 *
 * @param messages - 消息列表
 * @param sessionId - 会话 ID
 * @param onIncomplete - 不完整时的回调
 */
export function monitorToolResultIntegrity(
  messages: ChatMessage[],
  sessionId: string,
  onIncomplete?: (report: ToolResultIntegrityReport) => void,
): ToolResultIntegrityReport {
  const report = validateToolResultIntegrity(messages, sessionId);

  if (!report.isComplete && onIncomplete) {
    onIncomplete(report);
  }

  return report;
}