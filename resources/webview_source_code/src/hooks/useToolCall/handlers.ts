/**
 * 工具调用处理和按钮操作逻辑
 */

import { useCallback } from 'react';
import { ChatMessage } from '../../services';
import { useChatStreamStore } from '../../store/chat';
import { useChatApplyStore } from '../../store/chatApply';
import { usePostMessage, BroadcastActions } from '../../PostMessageProvider';
import { UserEvent } from '../../types/report';
import { updateCurrentSession } from '../useCurrentSession';
import EventBus, { EBusEvent } from '../../utils/eventbus';
import {
  ETerminalStatus,
  terminalCmdFunction,
  useTerminalMessage,
} from '../../routes/CodeChat/ChatMessagesList/TermialPanel';
import { ToolCallHandlers } from './types';

export function useToolCallHandlers(
  message: ChatMessage,
  toolResponse: { [propName: string]: boolean },
  unselectedResults: Set<string>,
  setToolResponse: React.Dispatch<
    React.SetStateAction<{ [propName: string]: boolean }>
  >,
  hasEditFileTool: boolean,
  hasTerminalTool: boolean,
  hasMCPTool: boolean,
  hasMakePlanTool: boolean,
  hasTodoTool: boolean,
): ToolCallHandlers {
  const onUserSubmit = useChatStreamStore((state) => state.onUserSubmit);
  const isTerminalProcessing = useChatStreamStore(
    (state) => state.isTerminalProcessing,
  );
  const setIsTerminalProcessing = useChatStreamStore(
    (state) => state.setIsTerminalProcessing,
  );
  const setIsMCPProcessing = useChatStreamStore(
    (state) => state.setIsMCPProcessing,
  );
  const acceptEdit = useChatApplyStore((state) => state.acceptEdit);
  const rejectEdit = useChatApplyStore((state) => state.rejectEdit);
  const { postMessage } = usePostMessage();
  const { updateTerminalLog } = useTerminalMessage();

  // 查找命令工具
  const commandTool = message.tool_calls?.find(
    (tool) => tool.function.name === terminalCmdFunction,
  );

  // 执行命令工具
  const execCommandTool = useCallback(
    (accept: boolean) => {
      if (!commandTool?.id) return;
      if (isTerminalProcessing) return;
      let params: any = {};
      try {
        params = JSON.parse(commandTool?.function?.arguments || '{}');
        params.messageId = message.id || '';
        params.is_approve = accept || false;
      } catch (err) {
        console.error(err);
        params = {};
      }
      // 终端进入等待状态
      updateTerminalLog(
        {
          messageId: message.id || '',
          terminalId: commandTool?.id,
          log: '',
          terminalStatus: accept
            ? ETerminalStatus.START
            : ETerminalStatus.CANCELED,
        },
        true,
      );
      setIsTerminalProcessing(true);
      window.parent.postMessage(
        {
          type: BroadcastActions.TOOL_CALL,
          data: {
            tool_name: commandTool.function.name,
            tool_params: params,
            tool_id: commandTool?.id,
          },
        },
        '*',
      );
    },
    [
      commandTool?.function?.arguments,
      commandTool?.function?.name,
      commandTool?.id,
      isTerminalProcessing,
      message.id,
      setIsTerminalProcessing,
      updateTerminalLog,
    ],
  );

  // 主工具调用处理
  const handleToolCall = useCallback(
    (accept: boolean) => {
      EventBus.instance.dispatch(EBusEvent.CodeChat_Unlock_Scroll);

      if (commandTool) {
        execCommandTool(accept);
        return;
      }

      // 处理编辑文件工具
      if (hasEditFileTool && message.tool_calls) {
        const editTool = message.tool_calls.find((tool) =>
          ['edit_file', 'reapply', 'replace_in_file', 'edit', 'write'].includes(
            tool.function.name,
          ),
        );
        if (editTool) {
          if (accept) {
            // 应用编辑
            acceptEdit(editTool.id);
          } else {
            // 拒绝编辑
            rejectEdit(editTool.id);
            onUserSubmit(
              '',
              {
                event: UserEvent.CODE_CHAT_CODEBASE,
              },
              undefined,
              {
                [editTool.id]: false,
              },
            );
          }
          return;
        }
      }

      // 处理 MCP 工具调用
      if (hasMCPTool && message.tool_calls) {
        const mcpTool = message.tool_calls.find(
          (tool) =>
            tool.function.name === 'use_mcp_tool' ||
            tool.function.name === 'access_mcp_resource',
        );
        if (mcpTool && accept) {
          // 更新 response 状态
          const response = {
            ...toolResponse,
          };
          response[mcpTool.id] = true;

          // 立即更新本地状态让按钮消失
          setToolResponse(response);

          // 设置处理状态
          setIsMCPProcessing(true);

          // 发送工具调用消息
          let toolCallParams: any = {};
          try {
            toolCallParams = JSON.parse(mcpTool.function.arguments || '{}');
          } catch (err) {
            console.error('解析 ToolCall 参数失败', err);
          }

          // 先发送工具调用，等待 MCP 返回后再更新 message.response
          postMessage({
            type: BroadcastActions.TOOL_CALL,
            data: {
              tool_name: mcpTool.function.name,
              tool_params: toolCallParams,
              tool_id: mcpTool.id,
            },
          });
          return;
        }
        // 取消 MCP 调用
        if (mcpTool && !accept) {
          const response = {
            ...toolResponse,
          };
          Object.keys(response).forEach((toolId) => {
            response[toolId] = false;
          });
          onUserSubmit(
            '',
            {
              event: UserEvent.CODE_CHAT_CODEBASE,
            },
            undefined,
            response,
          );
          setToolResponse(response);
          return;
        }
      }

      // 处理 make_plan 工具
      if (hasMakePlanTool) {
        updateCurrentSession((session) => {
          if (session.data) {
            session.data.planModeState = accept ? 'approved' : 'rejected';
          }
        });
      }

      // 默认处理
      const response = {
        ...toolResponse,
      };
      if (accept) {
        onUserSubmit(
          '',
          {
            event: UserEvent.CODE_CHAT_CODEBASE,
          },
          undefined,
          response,
          unselectedResults,
        );
        setToolResponse(response);
      } else {
        Object.keys(response).forEach((toolId) => {
          response[toolId] = false;
        });
        onUserSubmit(
          '',
          {
            event: UserEvent.CODE_CHAT_CODEBASE,
          },
          undefined,
          response,
          new Set(), // 拒绝时传递空的 Set
        );
        setToolResponse(response);
      }
    },
    [
      commandTool,
      execCommandTool,
      hasEditFileTool,
      hasMakePlanTool,
      hasMCPTool,
      message.tool_calls,
      acceptEdit,
      rejectEdit,
      onUserSubmit,
      postMessage,
      setIsMCPProcessing,
      toolResponse,
      unselectedResults,
      setToolResponse,
    ],
  );

  // 获取按钮标签
  const getBtnLabel = useCallback(
    (isAccept: boolean) => {
      if (isAccept) {
        if (hasTerminalTool) return '执行';
        if (hasEditFileTool) return '应用修改';
        if (hasMCPTool) return '确认调用';
        return '允许';
      } else {
        if (hasTerminalTool) return '取消';
        if (hasTodoTool || hasMakePlanTool) return '修改';
        if (hasMCPTool) return '取消';
        return '拒绝';
      }
    },
    [
      hasTerminalTool,
      hasEditFileTool,
      hasTodoTool,
      hasMakePlanTool,
      hasMCPTool,
    ],
  );

  return {
    handleToolCall,
    execCommandTool,
    getBtnLabel,
  };
}
