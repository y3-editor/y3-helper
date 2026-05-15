import { BroadcastActions } from '../PostMessageProvider';
import { useChatConfig } from '../store/chat-config';
import { useExtensionStore } from '../store/extension';

/**
 * Shared guard: RTK is only enabled when both the user toggle is on
 * AND the RTK binary is confirmed available on disk.
 */
export const getEnableRtk = () =>
  useChatConfig.getState().rtkEnabled && useExtensionStore.getState().rtkBinaryAvailable;

/**
 * Current chat model code (e.g. "deepseek-v4"). Empty string when unset.
 * Used by the IDE side to attach `model` to RTK savings telemetry.
 *
 * Y3 NOTE: Y3 后端不消费 RTK 遥测 (extension 60dc7065/0b41e271 整组未合)。
 *          此函数与下方 `params.model` 注入保留以维持与上游对齐，避免下次同步
 *          产生无意义 REVIEW 噪音；后端 executeFunction.ts 直接忽略该字段。
 */
export const getCurrentModel = (): string => useChatConfig.getState().config.model || '';

/**
 * Dispatch a TOOL_CALL message to the IDE extension.
 * Injects enableRtk + model for run_terminal_cmd based on chat-config store and binary availability.
 */
export function dispatchToolCall(
  toolName: string,
  toolParams: any,
  toolId: string,
  extraFields?: Record<string, any>,
): void {
  const params = { ...toolParams };
  if (toolName === 'run_terminal_cmd') {
    params.enableRtk = getEnableRtk();
    params.model = getCurrentModel();
  }

  window.parent.postMessage(
    {
      type: BroadcastActions.TOOL_CALL,
      data: {
        tool_name: toolName,
        tool_params: params,
        tool_id: toolId,
        ...extraFields,
      },
    },
    '*',
  );
}
