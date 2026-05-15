/**
 * Repeat tool_call guard：跨轮次检测 "同一批 tool_call + 同一批参数" 的死循环。
 *
 * 入口：evaluateRepeatGuard
 *  - 输入一轮 filter 后的 toolCalls、(sessionId, agentKey)
 *  - 更新 store 的计数器，返回动作（pass / warn / abort）及辅助产物
 *
 * 调用方按返回的 action 决定：
 *   - pass  : 正常分发 tool_calls
 *   - warn  : 跳过本轮执行；把 warnToolResults 回灌给模型；在 UI 落一条 systemNotice 消息
 *   - abort : 中止当前 stream；在 UI 落一条 systemNotice 消息；不回灌 tool_result
 *
 * 该模块只做决策与产物构造，不直接触碰 store；由 main agent / subagent 各自的 onMessage 调用。
 */

import type { ToolCall, ToolResult, ChatMessage } from '../services';
import { computeRoundKey } from './computeRoundKey';
import {
  useToolCallRepeatStore,
  type AgentKey,
  type RepeatGuardAction,
} from '../store/toolCallRepeatStore';
import userReporter from './report';
import { UserEvent } from '../types/report';

export interface RepeatGuardResult {
  action: RepeatGuardAction;
  count: number;
  /** 规范化得到的轮 key，用于 telemetry / 调试 */
  roundKey: string;
  /** action=warn 时提供：应写回 tool_result 的映射 { [toolCallId]: ToolResult } */
  warnToolResults?: Record<string, ToolResult>;
  /** 渲染层要展示的系统通知，action=pass 时为 undefined */
  notice?: NonNullable<ChatMessage['systemNotice']>;
  /** UI 可见的中文文案 */
  noticeText?: string;
}

const WARN_MESSAGE_TEMPLATE = (toolNames: string[]) =>
  `检测到连续 3 次请求相同的工具调用（${toolNames.join(', ') || 'unknown'}），本次已跳过。请停止重复工具调用，按照实际任务目标继续推进。`;

const ABORT_MESSAGE_TEMPLATE = (toolNames: string[]) =>
  `检测到连续 4 次请求相同的工具调用（${toolNames.join(', ') || 'unknown'}），已自动中止本次对话以避免无效循环。`;

function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

export function evaluateRepeatGuard(params: {
  sessionId: string;
  agentKey: AgentKey;
  toolCalls: ToolCall[];
  model?: string;
}): RepeatGuardResult {
  const { sessionId, agentKey, toolCalls, model } = params;

  if (!sessionId || !toolCalls || toolCalls.length === 0) {
    return { action: 'pass', count: 0, roundKey: '' };
  }

  const roundKey = computeRoundKey(toolCalls);
  if (!roundKey) {
    return { action: 'pass', count: 0, roundKey: '' };
  }

  const { action, count } = useToolCallRepeatStore
    .getState()
    .observe(sessionId, agentKey, roundKey);

  if (action === 'pass') {
    return { action, count, roundKey };
  }

  const toolNames = Array.from(
    new Set(
      toolCalls
        .map((tc) => tc?.function?.name)
        .filter((n): n is string => !!n),
    ),
  );

  if (action === 'warn') {
    const warnMessage = WARN_MESSAGE_TEMPLATE(toolNames);
    const warnToolResults: Record<string, ToolResult> = {};
    for (const tc of toolCalls) {
      if (!tc?.id) continue;
      warnToolResults[tc.id] = {
        path: '',
        content: warnMessage,
        isError: true,
      };
    }

    userReporter.report({
      event: UserEvent.CODE_CHAT_REPEAT_TOOLCALL_WARN,
      extends: {
        toolNames,
        sessionId,
        agentKey,
        model: model || '',
        roundKeyHash: hashKey(roundKey),
      },
    });

    return {
      action,
      count,
      roundKey,
      warnToolResults,
      notice: { kind: 'repeat-toolcall-warn', toolNames, text: warnMessage },
      noticeText: warnMessage,
    };
  }

  // abort
  const abortMessage = ABORT_MESSAGE_TEMPLATE(toolNames);
  userReporter.report({
    event: UserEvent.CODE_CHAT_REPEAT_TOOLCALL_ABORT,
    extends: {
      toolNames,
      sessionId,
      agentKey,
      model: model || '',
      roundKeyHash: hashKey(roundKey),
    },
  });

  return {
    action,
    count,
    roundKey,
    notice: { kind: 'repeat-toolcall-abort', toolNames, text: abortMessage },
    noticeText: abortMessage,
  };
}
