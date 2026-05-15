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
 * Dispatch a TOOL_CALL message to the IDE extension.
 * Injects enableRtk for run_terminal_cmd based on chat-config store and binary availability.
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