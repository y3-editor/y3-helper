import {
  Box,
  Flex,
  Button,
} from '@chakra-ui/react';
import { ToolCallProps } from './types';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useWorkspaceStore } from '../../../store/workspace';
import { usePanelContextOptional } from '../../../context/PanelContext';
// import { useConfigStore } from '../../../store/config';
import { useChatConfig } from '../../../store/chat-config';
// import { pathsMatch } from '../../../utils/common';
import { useChatStore, useChatStreamStore } from '../../../store/chat';
import useCustomToast from '../../../hooks/useCustomToast';
import { IDE, useExtensionStore } from '../../../store/extension';
import ToolCallResults from './ToolCallResults';
import { usePostMessage } from '../../../PostMessageProvider';
import {
  ETerminalStatus,
  terminalCmdFunction,
  useChatTerminal,
  useTerminalMessage,
} from './TermialPanel';
import { useChatTerminalStore } from '../../../store/chatTerminal';
import { BroadcastActions } from '../../../PostMessageProvider';
import { UserEvent } from '../../../types/report';
import ConfirmPopver from '../../../components/ConfirmPopver';
import { updateCurrentSession } from '../../../hooks/useCurrentSession';
import EventBus, { EBusEvent } from '../../../utils/eventbus';
import TaskProgressPanel, { AutoConfigItem } from '../TaskProgressPanel';
import { getToolCallQuery } from '../../../utils/toolCall';
import { useMCPStore } from '../../../store/mcp';
import { useChatApplyStore } from '../../../store/chatApply';
import { useShallow } from 'zustand/react/shallow';
import { notifyChatReplyDone, notificationManager } from '../../../utils/chatNotification';

export default function ToolCall(props: ToolCallProps) {
  const { message, isShare, isLatest } = props;

  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);
  const panelContext = usePanelContextOptional();
  const onUserSubmit = useChatStreamStore((state) => state.onUserSubmit);
  const currentSession = useChatStore((state) => state.currentSession());
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isMCPProcessing = useChatStreamStore((state) => state.isMCPProcessing);
  const isTerminalProcessing = useChatStreamStore(
    (state) => state.isTerminalProcessing,
  );
  const setIsTerminalProcessing = useChatStreamStore(
    (state) => state.setIsTerminalProcessing,
  );
  const setIsMCPProcessing = useChatStreamStore(
    (state) => state.setIsMCPProcessing,
  );
  const { toast } = useCustomToast();
  const ide = useExtensionStore((state) => state.IDE);
  const isVsCodeIDE = ide === IDE.VisualStudioCode;
  const isJetBrainsIDE = ide === IDE.JetBrains;
  const { postMessage } = usePostMessage();

  const [isAuthorizationPathCheck] =
    useState(false);
  const [toolResponse, setToolResponse] = useState<{
    [propName: string]: boolean;
  }>({});
  const [unselectedResults, setUnselectedResults] = useState<Set<string>>(
    new Set(),
  );
  const hasNotifiedRef = useRef<boolean>(false);
  const { updateTerminalLog } = useTerminalMessage();

  const enableTerminal = useChatTerminalStore((state) => state.enableTerminal);
  const autoApprove = useChatConfig((state) => state.autoApprove);
  const updateAutoApprove = useChatConfig((state) => state.updateAutoApprove);
  const autoApply = useChatConfig((state) => state.autoApply);
  const updateAutoApply = useChatConfig((state) => state.updateAutoApply);
  const autoExecute = useChatConfig((state) => state.autoExecute);
  const updateAutoExecute = useChatConfig((state) => state.updateAutoExecute);
  const autoTodo = useChatConfig((state) => state.autoTodo);
  const updateAutoTodo = useChatConfig((state) => state.updateAutoTodo);

  const MCPServers = useMCPStore((state) => state.MCPServers);
  const builtInServers = useMCPStore((state) => state.builtInServers);
  const getChineseNameByServerName = useMCPStore((state) => state.getChineseNameByServerName);

  const [
    acceptEdit,
    rejectEdit
  ] = useChatApplyStore(useShallow((state) => [
    state.acceptEdit,
    state.rejectEdit
  ]));

  // const configState = useConfigStore.getState();
  // const codebaseDefaultAuthorizationPathValue =
  //   configState.config.codebaseDefaultAuthorizationPath;

  // const codebaseDefaultAuthorizationPath = useMemo(() => {
  //   return codebaseDefaultAuthorizationPathValue || [];
  // }, [codebaseDefaultAuthorizationPathValue]);

  const hasEditFileTool = useMemo(() => {
    if (!message.tool_calls) {
      return false;
    }
    return message.tool_calls.some((tool) =>
      ['edit_file', 'reapply', 'replace_in_file'].includes(tool.function.name),
    );
  }, [message]);

  const hasListFilesTool = useMemo(() => {
    if (!message.tool_calls) {
      return false;
    }
    return message.tool_calls.some((tool) =>
      ['list_files_top_level', 'list_files_recursive', 'view_source_code_definitions_top_level'].includes(tool.function.name),
    );
  }, [message]);

  const hasReadFileTool = useMemo(() => {
    if (!message.tool_calls) {
      return false;
    }
    return message.tool_calls.some((tool) =>
      tool.function.name === 'read_file',
    );
  }, [message]);

  const hasMCPTool = useMemo(() => {
    if (!message.tool_calls) {
      return false;
    }
    return message.tool_calls.some(
      (tool) =>
        tool.function.name === 'use_mcp_tool' ||
        tool.function.name === 'access_mcp_resource',
    );
  }, [message]);

  const hasMakePlanTool = useMemo(() => {
    if (!message.tool_calls) {
      return false;
    }
    return message.tool_calls.some(
      (tool) => tool.function.name === 'make_plan',
    );
  }, [message]);

  const hasTodoTool = useMemo(() => {
    if (!message.tool_calls) {
      return false;
    }
    return message.tool_calls.some(
      (tool) => tool.function.name === 'write_todo',
    );
  }, [message]);

  const hasAskUserQuestionTool = useMemo(() => {
    if (!message.tool_calls) {
      return false;
    }
    return message.tool_calls.some(
      (tool) => tool.function.name === 'ask_user_question',
    );
  }, [message]);

  const { hasTerminalTool, hasDangerousCommand } = useChatTerminal(message);

  const mcpServerName = useMemo(() => {
    if (!hasMCPTool || !message.tool_calls) return null;
    const mcpTool = message.tool_calls.find(tool =>
      tool.function.name === 'use_mcp_tool' ||
      tool.function.name === 'access_mcp_resource'
    );
    if (!mcpTool) return null;
    try {
      const params = JSON.parse(mcpTool.function.arguments || '{}');
      let name = params.server_name || '';
      name = name.replace('\\', '/');
      name = name.split('/').slice(-1)[0];
      return name;
    } catch {
      return null;
    }
  }, [hasMCPTool, message.tool_calls]);

  const mcpServer = useMemo(() => {
    if (!mcpServerName) return null;
    return MCPServers.find(s => {
      let serverName = s.name || '';
      serverName = serverName.replace('\\', '/');
      serverName = serverName.split('/').slice(-1)[0];
      return serverName === mcpServerName;
    });
  }, [mcpServerName, MCPServers]);

  const mcpServerDisplayName = useMemo(() => {
    if (!mcpServer) return mcpServerName || '';
    const builtInServer = builtInServers.find(bis => bis.name === mcpServer.name);
    return mcpServer.config?.chinese_name
      || getChineseNameByServerName(mcpServer.name)
      || builtInServer?.chinese_name
      || mcpServerName
      || '';
  }, [mcpServer, mcpServerName, builtInServers, getChineseNameByServerName]);

  // 记录 MCP autoApprove 的初始状态，用于决定是否显示开关
  // 这样即使用户在当前页面勾选了开关，开关也不会立即消失
  const initialMCPAutoApprove = useMemo(() => {
    return mcpServer?.config?.autoApprove || false;
  }, [mcpServer?.name]); // 只依赖 mcpServer.name，这样初始值不会随 config 变化而变化

  useEffect(() => {
    if (message.tool_calls) {
      const response: {
        [propName: string]: boolean;
      } = message.response
          ? {
            ...message.response,
          }
          : {};
      for (const tool of message.tool_calls) {
        if (response[tool.id] !== false) {
          response[tool.id] = true;
        }
      }
      setToolResponse(response);
    }
  }, [message.response, message.tool_calls]);

  const handleSelectionChange = (
    id: string,
    isSelected: boolean,
    toolId: string,
  ) => {
    setUnselectedResults((prev) => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }

      // 找到对应工具的所有结果
      const currentTool = message.tool_calls?.find(
        (tool) => tool.id === toolId,
      );
      if (currentTool) {
        const toolCallResults = message.tool_result || {};
        const result = toolCallResults[toolId] || {};

        try {
          const retrievedResults: any[] = [];
          if (currentTool.function.name === 'retrieve_code') {
            const searchResult = JSON.parse(result.content);
            searchResult.forEach((item: any, index: number) => {
              // 添加主函数结果
              retrievedResults.push({
                id:
                  (item.func_name
                    ? item.func_name.split('\n').slice(-1)[0]
                    : '') + index,
              });

              // 添加to_func子函数结果
              if (item.to_func) {
                item.to_func.forEach(() => {
                  retrievedResults.push({
                    id:
                      (item.func_name
                        ? item.func_name.split('\n').slice(-1)[0]
                        : '') + index,
                  });
                });
              }
            });
          } else if (currentTool.function.name === 'retrieve_knowledge') {
            const searchResult = JSON.parse(result.content);
            searchResult.forEach((item: any, index: number) => {
              retrievedResults.push({
                id: item.attributes.filename + index,
              });
            });
          }

          // 更新toolResponse状态
          const nextToolResponse = { ...toolResponse };

          if (retrievedResults.length > 0) {
            // 如果所有结果都被取消选择，将工具响应设置为false
            if (newSet.size === retrievedResults.length) {
              nextToolResponse[toolId] = false;
            } else if (newSet.size < retrievedResults.length) {
              // 只要有结果被选中，就将工具响应设置为true
              nextToolResponse[toolId] = true;
            }
          }

          setToolResponse(nextToolResponse);
        } catch (e) {
          console.warn('处理检索结果出错:', e);
        }
      }

      return newSet;
    });
  };

  const repoNotMatch = useMemo(() => {
    let notMatch = false;
    if (workspaceInfo.repoName) {
      if (
        currentSession?.chat_repo &&
        currentSession?.chat_repo !== workspaceInfo.repoName
      ) {
        notMatch = true;
      }
    } else {
      notMatch = true;
    }
    return notMatch;
  }, [currentSession?.chat_repo, workspaceInfo.repoName]);

  const pathList = useMemo(() => {
    const pathList: any = [];
    message.tool_calls?.map((tool) => {
      const result = toolResponse[tool.id];
      if (result) {
        const toolCallResults = message.tool_result || {};
        const result = toolCallResults[tool.id] || {};
        if (result.path) {
          pathList.push(result.path);
        }
      }
    });
    return pathList;
  }, [message.tool_calls, message.tool_result, toolResponse]);

  const toolResponseDisabled = useMemo(() => {
    if (!message.tool_calls || !message.tool_calls.length) {
      return true;
    }
    return (
      Object.keys(message.response || {}).length === message.tool_calls.length
    );
  }, [message.response, message.tool_calls]);

  const enbleCommandTool = useMemo(() => {
    if (!message.tool_calls) {
      return false;
    }
    return message.tool_calls.some((tool) => {
      if (tool.function.name !== terminalCmdFunction) return false;
      const toolCallResult = message.tool_result?.[tool.id];
      return !!toolCallResult?.extra?.terminalStatus;
    });
  }, [message?.tool_result, message?.tool_calls]);

  // 判断message.tool_calls里面是否有retrieve_code和retrieve_knowledge
  // const isRetrievedCodeOrKnowledge = useMemo(() => {
  //   return (
  //     message.tool_calls?.some(
  //       (tool) =>
  //         tool.function.name === 'retrieve_code' ||
  //         tool.function.name === 'retrieve_knowledge',
  //     ) || false
  //   );
  // }, [message.tool_calls]);

  const commandTool = useMemo(() => {
    return message.tool_calls?.find(
      (tool) => tool.function.name === terminalCmdFunction,
    );
  }, [message.tool_calls]);

  const toolCallTitle = useMemo(() => {
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return '工具调用';
    }
    // 使用第一个工具调用来生成标题
    const firstTool = message.tool_calls[0];
    return getToolCallQuery(firstTool.function.name, firstTool.function.arguments || '');
  }, [message.tool_calls]);

  // 判断是否是文件相关操作，需要显示仓库自动读取 checkbox
  const isFileRelatedTool = useMemo(() => {
    if (!message.tool_calls) {
      return false;
    }
    return message.tool_calls.some((tool) =>
      ['read_file',
        'list_dir',
        'list_files_top_level',
        'list_files_recursive',
        'search_files',
        'grep_search',
        'edit_file',
        'reapply',
        'replace_in_file',
        'write_to_file'
      ].includes(tool.function.name),
    );
  }, [message.tool_calls]);

  // 判断是否有工具调用错误
  const hasToolCallError = useMemo(() => {
    if (!message.tool_result) {
      return false;
    }
    return Object.values(message.tool_result).some((result) => result.isError);
  }, [message.tool_result]);

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

  const openExtensionSetting = useCallback(() => {
    postMessage({
      type: 'OPEN_EXTENSION_SETTING_AUTHORIZATION_PATH',
    });
  }, [postMessage]);

  const autoApproveTip = useMemo(() => {
    return (
      <span>
        开启后，智聊过程将自动进行目录/文件授权，可通过
        <Button
          variant="link"
          color="#776fff"
          onClick={(e) => {
            e.stopPropagation();
            openExtensionSetting();
          }}
        >
          配置忽略目录
        </Button>
        来保护敏感文件。
      </span>
    );
  }, [openExtensionSetting]);

  const autoApplyTip = useMemo(() => {
    return '开启后，智聊过程的代码修改将自动应用，可通过消息回撤来恢复变更。';
  }, []);

  const autoExecuteTip = useMemo(() => {
    return (
      <span>
        开启后，智聊过程需运行的命令将自动执行，可通过
        <Button
          variant="link"
          color="#776fff"
          onClick={(e) => {
            e.stopPropagation();
            openExtensionSetting();
          }}
        >
          配置忽略命令
        </Button>
        来规避高危操作。
      </span>
    );
  }, [openExtensionSetting]);

  const autoTodoTip = useMemo(() => {
    return '开启后，智聊过程生成的plan执行过程全自动，无需手动确认';
  }, []);

  const mcpAutoApproveTip = useMemo(() => {
    return `开启后，智聊过程将自动调用 ${mcpServerDisplayName}，无需手动确认请求与参数`;
  }, [mcpServerDisplayName]);

  // MCP switch 的 onChange 处理函数，使用 useCallback 避免重新渲染
  const handleMcpSwitchChange = useCallback((checked: boolean) => {
    postMessage({
      type: BroadcastActions.UPDATE_MCP_SERVERS,
      data: {
        name: mcpServerName,
        ...mcpServer?.config,
        autoApprove: checked,
      },
    });
  }, [mcpServerName, mcpServer?.config, postMessage]);

  const autoConfigItems = useMemo((): AutoConfigItem[] => {
    const items: AutoConfigItem[] = [];

    // 仓库自动读取 - 文件相关工具时显示（但有编辑文件工具时不显示）
    if (isFileRelatedTool && !isShare && !repoNotMatch && !hasEditFileTool) {
      items.push({
        label: '仓库自动读取',
        checked: autoApprove,
        onChange: updateAutoApprove,
        tip: autoApproveTip,
      });
    }

    // Plan 自动执行 - 只有 todo 工具时显示（make_plan 不显示）
    if (hasTodoTool && !hasMakePlanTool && !isShare) {
      items.push({
        label: 'Plan 自动执行',
        checked: autoTodo,
        onChange: updateAutoTodo,
        tip: autoTodoTip,
      });
    }

    // 代码自动应用 - 有编辑文件工具时显示
    if (hasEditFileTool && !isShare) {
      items.push({
        label: '代码自动应用',
        checked: autoApply,
        onChange: updateAutoApply,
        tip: autoApplyTip,
      });
    }

    // 命令自动执行 - 有终端工具时显示
    if (hasTerminalTool && !isShare && enableTerminal && (isVsCodeIDE || isJetBrainsIDE)) {
      items.push({
        label: '命令自动执行',
        checked: autoExecute,
        onChange: updateAutoExecute,
        tip: autoExecuteTip,
      });
    }

    // MCP自动调用 - 基于初始状态决定是否显示开关
    // 如果初始时未开启，则显示开关（即使用户在当前页面勾选了也继续显示）
    // 如果初始时已开启，则不显示开关
    if (hasMCPTool && !isShare && mcpServer && mcpServerName && !initialMCPAutoApprove) {
      items.push({
        label: `${mcpServerDisplayName} 自动调用`,
        checked: mcpServer?.config?.autoApprove || false, // 使用实时状态显示勾选状态
        onChange: handleMcpSwitchChange,
        tip: mcpAutoApproveTip,
      });
    }

    return items;
  }, [isFileRelatedTool, isShare, repoNotMatch, hasEditFileTool, hasMakePlanTool, hasTodoTool, hasTerminalTool, enableTerminal, isVsCodeIDE, isJetBrainsIDE, hasMCPTool, mcpServer, mcpServerName, autoApprove, updateAutoApprove, autoApproveTip, autoTodo, updateAutoTodo, autoTodoTip, autoApply, updateAutoApply, autoApplyTip, autoExecute, updateAutoExecute, autoExecuteTip, mcpServerDisplayName, mcpAutoApproveTip, handleMcpSwitchChange, initialMCPAutoApprove]);

  // 当需要用户操作时发起通知
  useEffect(() => {
    // 判断是否有自动执行开关被开启
    const hasAutoExecuteEnabled = (
      (isFileRelatedTool && autoApprove) ||  // 仓库自动读取
      (hasEditFileTool && autoApply) ||      // 代码自动应用
      (hasTerminalTool && autoExecute) ||    // 命令自动执行
      (hasTodoTool && autoTodo) ||           // Plan 自动执行
      (hasMCPTool && mcpServer?.config?.autoApprove) // MCP 自动调用
    );
    
    // 只有最新消息且需要用户操作时才发送通知（如果开启了自动执行则不需要用户操作）
    const needsUserAction = !toolResponseDisabled && 
                           !isProcessing && 
                           !isMCPProcessing && 
                           !isShare && 
                           !hasAskUserQuestionTool && 
                           !repoNotMatch &&
                           !hasAutoExecuteEnabled; // 如果有自动执行开关开启，则不需要用户操作
    
    if (isLatest && needsUserAction && !hasNotifiedRef.current) {
      // 立即标记已通知，防止重复通知
      hasNotifiedRef.current = true;
      
      // 标记高优先级通知已发送
      notificationManager.setHighPriorityNotified(message.id || '');
      
      // 根据不同工具类型生成不同的通知消息
      let notificationMessage = '';
      if (hasTerminalTool) {
        notificationMessage = '需要确认命令执行';
      } else if (hasEditFileTool) {
        notificationMessage = '需要确认代码修改';
      } else if (hasMCPTool) {
        notificationMessage = `需要确认 ${mcpServerDisplayName} 调用`;
      } else if (hasMakePlanTool) {
        notificationMessage = '需要确认执行计划';
      } else if (hasTodoTool) {
        notificationMessage = '需要确认任务操作';
      } else {
        notificationMessage = '需要用户确认操作';
      }
      
      notifyChatReplyDone({
        topic: currentSession?.topic,
        success: true,
        userQuestion: notificationMessage,
        panelId: panelContext?.panelId,
        mode: panelContext?.mode,
        isHighPriority: true, // 标记为高优先级通知
      });
    }

    // 当不再需要用户操作时，重置通知状态
    if (!needsUserAction && hasNotifiedRef.current) {
      hasNotifiedRef.current = false;
    }
  }, [
    isLatest, 
    toolResponseDisabled, 
    isProcessing, 
    isMCPProcessing, 
    isShare, 
    hasAskUserQuestionTool,
    repoNotMatch,
    hasTerminalTool,
    hasEditFileTool,
    hasMCPTool,
    hasMakePlanTool,
    hasTodoTool,
    currentSession?.topic,
    panelContext?.panelId,
    panelContext?.mode,
    mcpServerDisplayName,
    message.id,
    isFileRelatedTool,
    autoApprove,
    autoApply,
    autoExecute,
    autoTodo,
    mcpServer?.config?.autoApprove
  ]);

  const handleToolCall = useCallback(
    (accept: boolean) => {
      EventBus.instance.dispatch(EBusEvent.CodeChat_Unlock_Scroll)
      if (commandTool) {
        execCommandTool(accept);
        return;
      }

      // 处理编辑文件工具
      if (hasEditFileTool && message.tool_calls) {
        const editTool = message.tool_calls.find(tool =>
          ['edit_file', 'reapply', 'replace_in_file'].includes(tool.function.name)
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
                [editTool.id]: false
              }
            );
          }
          return;
        }
      }

      // 处理 MCP 工具调用
      if (hasMCPTool && message.tool_calls) {
        const mcpTool = message.tool_calls.find(tool =>
          tool.function.name === 'use_mcp_tool' ||
          tool.function.name === 'access_mcp_resource'
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

      if (hasMakePlanTool) {
        updateCurrentSession((session) => {
          if (session.data) {
            session.data.planModeState = accept ? 'approved' : 'rejected';
          }
        });
      }

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
    [commandTool, execCommandTool, hasEditFileTool, hasMakePlanTool, hasMCPTool, message.tool_calls, acceptEdit, rejectEdit, onUserSubmit, postMessage, setIsMCPProcessing, toolResponse, unselectedResults],
  );

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
    [hasTerminalTool, hasEditFileTool, hasTodoTool, hasMakePlanTool, hasMCPTool],
  );

  const addAuthorizationPath = (path: string[]) => {
    postMessage({
      type: 'ADD_AUTHORIZATION_PATH',
      data: {
        path,
      },
    });
    toast({
      title: (
        <Box>
          已将路径添加到自动授权名单，
          <Button variant="link" color="#776fff" onClick={openExtensionSetting}>
            点击查看
          </Button>
        </Box>
      ),
      position: 'top',
      isClosable: true,
      duration: 2000,
      status: 'success',
    });
  };

  // let toolActionHint = '仅同意授权的数据会与大模型交互，请放心';
  // if (repoNotMatch) {
  //   toolActionHint = `当前会话关联仓库 ${currentSession?.chat_repo}，请切换到该仓库下使用或新建会话`;
  // } else if (hasDangerousCommand) {
  //   toolActionHint = '存在危险命令，请谨慎操作';
  // }

  if (toolResponseDisabled || enbleCommandTool) {
    if (hasTodoTool) return null;
    return (
      <TaskProgressPanel
        headerContent={toolCallTitle}
        showHeader={!hasEditFileTool && !hasTerminalTool && !hasMCPTool && !hasToolCallError && !hasMakePlanTool && !hasAskUserQuestionTool && !hasListFilesTool && !hasReadFileTool}
      >
        <ToolCallResults
          message={message}
          toolResponseDisabled={toolResponseDisabled}
          toolResponse={toolResponse}
          unselectedResults={unselectedResults}
          handleSelectionChange={handleSelectionChange}
          isLatest={isLatest}
        />
      </TaskProgressPanel>
    );
  }

  return (
    <TaskProgressPanel
      headerContent={toolCallTitle}
      autoConfigItems={autoConfigItems}
      showHeader={!hasEditFileTool && !hasTerminalTool && !hasMCPTool && !hasToolCallError && !hasMakePlanTool && !hasAskUserQuestionTool && !hasListFilesTool && !hasReadFileTool}
      footerContent={
        !toolResponseDisabled &&
        !isProcessing &&
        !isMCPProcessing &&
        !isShare &&
        !hasAskUserQuestionTool ? (
          <>
            <Flex mt={0} gap={2} alignItems="center">
              <ConfirmPopver
                disabled={!hasDangerousCommand}
                title={'温馨提示'}
                description={'当前指令涉及文件/系统修改,请谨慎决定执行'}
                comfirmAfterDisabled={true}
                onConfirm={() => {
                  if (repoNotMatch) {
                    return;
                  }
                  handleToolCall(true);
                  if (isAuthorizationPathCheck) {
                    addAuthorizationPath(pathList);
                  }
                }}
              >
                <Button
                  size="sm"
                  variant="unstyled"
                  disabled={repoNotMatch}
                  cursor={repoNotMatch ? 'not-allowed' : 'pointer'}
                  color={repoNotMatch ? 'gray.600' : '#7c7cff'}
                  fontSize="12px"
                  fontWeight="400"
                  _hover={
                    repoNotMatch ? undefined : { opacity: 0.8 }
                  }
                >
                  {getBtnLabel(true)}
                </Button>
              </ConfirmPopver>
              <Button
                size="sm"
                variant="unstyled"
                disabled={repoNotMatch || isAuthorizationPathCheck}
                cursor={
                  repoNotMatch || isAuthorizationPathCheck
                    ? 'not-allowed'
                    : 'pointer'
                }
                onClick={() => {
                  if (repoNotMatch || isAuthorizationPathCheck) {
                    return;
                  }
                  handleToolCall(false);
                }}
                color={
                  repoNotMatch || isAuthorizationPathCheck
                    ? 'gray.600'
                    : 'gray.400'
                }
                fontSize="12px"
                fontWeight="400"
                _hover={
                  repoNotMatch || isAuthorizationPathCheck
                    ? undefined
                    : { opacity: 0.8 }
                }
              >
                {getBtnLabel(false)}
              </Button>
            </Flex>
          </>
        ) : undefined
      }
    >
      <ToolCallResults
        message={message}
        toolResponseDisabled={toolResponseDisabled}
        toolResponse={toolResponse}
        unselectedResults={unselectedResults}
        handleSelectionChange={handleSelectionChange}
        isLatest={isLatest}
      />
    </TaskProgressPanel>
  );
}