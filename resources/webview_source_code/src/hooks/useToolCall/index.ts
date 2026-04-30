/**
 * 工具调用Hook - 统一入口
 *
 * 这是工具调用功能的单一入口点，整合了所有相关逻辑：
 * - 工具分类和环境检查
 * - MCP工具信息处理
 * - 状态管理
 * - 处理逻辑
 * - 标题生成
 * - 通知管理
 * - 自动配置项生成
 */

import { useMemo } from 'react';
import { ChatMessage } from '../../services';
import { useChatConfig } from '../../store/chat-config';

// 导入子模块
import { useToolClassification } from './../useToolCall/classification';
import { useMCPInfo } from './../useToolCall/mcpInfo';
import { useConfigTips } from './../useToolCall/tips';
import { useToolCallState } from './../useToolCall/state';
import { useToolCallHandlers } from './../useToolCall/handlers';
import { useToolCallTitle } from './../useToolCall/title';
import { useToolCallNotification } from './../useToolCall/notification';

// 导入类型
import type { ToolCallResult, AutoConfigItem } from './../useToolCall/types';

/**
 * 工具调用主Hook
 *
 * @param message - 聊天消息对象
 * @param isShare - 是否为分享模式
 * @param isLatest - 是否为最新消息
 * @returns 工具调用的完整状态和操作函数
 */
export function useToolCall(
  message: ChatMessage,
  isShare: boolean,
  isLatest: boolean,
): ToolCallResult {
  // 1. 基础分类和环境检查
  const classification = useToolClassification(message);
  const { toolTypeChecks, environmentChecks } = classification;

  // 2. MCP工具信息处理
  const mcpToolInfo = useMCPInfo(message, toolTypeChecks.hasMCPTool);

  // 3. 配置提示文本
  const tips = useConfigTips();

  // 4. 状态管理
  const state = useToolCallState(message);

  // 5. 处理逻辑
  const handlers = useToolCallHandlers(
    message,
    state.toolResponse,
    state.unselectedResults,
    state.setToolResponse,
    toolTypeChecks.hasEditFileTool,
    toolTypeChecks.hasTerminalTool,
    toolTypeChecks.hasMCPTool,
    toolTypeChecks.hasMakePlanTool,
    toolTypeChecks.hasTodoTool,
  );

  // 6. 标题生成
  const titleInfo = useToolCallTitle(
    message,
    toolTypeChecks.hasEditFileTool,
    toolTypeChecks.hasTerminalTool,
    toolTypeChecks.hasMCPTool,
    state.hasToolCallError,
    toolTypeChecks.hasMakePlanTool,
    toolTypeChecks.hasAskUserQuestionTool,
    toolTypeChecks.hasListFilesTool,
    toolTypeChecks.hasReadFileTool,
  );

  // 7. 更新函数
  const updateAutoApprove = useChatConfig((state) => state.updateAutoApprove);
  const updateAutoApply = useChatConfig((state) => state.updateAutoApply);
  const updateAutoExecute = useChatConfig((state) => state.updateAutoExecute);
  const updateAutoTodo = useChatConfig((state) => state.updateAutoTodo);

  const updateFunctions = useMemo(
    () => ({
      updateAutoApprove,
      updateAutoApply,
      updateAutoExecute,
      updateAutoTodo,
    }),
    [updateAutoApprove, updateAutoApply, updateAutoExecute, updateAutoTodo],
  );

  // 8. 计算是否有自动执行开关被开启
  const hasAutoExecuteEnabled = useMemo(() => {
    const permissions = classification.executionContext.permissions;
    if (!permissions) return false;

    return (
      (toolTypeChecks.isFileRelatedTool && permissions.autoApprove) || // 仓库自动读取
      (toolTypeChecks.hasEditFileTool && permissions.autoApply) || // 代码自动应用
      (toolTypeChecks.hasTerminalTool && permissions.autoExecute) || // 命令自动执行
      (toolTypeChecks.hasTodoTool && permissions.autoTodo) || // Plan 自动执行
      (toolTypeChecks.hasMCPTool && mcpToolInfo?.mcpServer?.config?.autoApprove) // MCP 自动调用
    );
  }, [
    classification.executionContext.permissions,
    toolTypeChecks,
    mcpToolInfo?.mcpServer?.config?.autoApprove,
  ]);

  // 9. 通知管理
  const notification = useToolCallNotification(
    message,
    isLatest,
    isShare,
    state.toolResponseDisabled,
    toolTypeChecks.hasAskUserQuestionTool,
    toolTypeChecks.hasTerminalTool,
    toolTypeChecks.hasEditFileTool,
    toolTypeChecks.hasMCPTool,
    toolTypeChecks.hasMakePlanTool,
    toolTypeChecks.hasTodoTool,
    toolTypeChecks.hasTaskTool,
    environmentChecks.repoNotMatch,
    mcpToolInfo?.mcpServerDisplayName,
    hasAutoExecuteEnabled,
  );

  // 10. 自动配置项生成
  const autoConfigItems = useMemo((): AutoConfigItem[] => {
    // Subagent 不显示自动配置项（因为总是自动执行）
    if (classification.executionContext.type === 'subagent' || isShare) {
      return [];
    }

    const items: AutoConfigItem[] = [];
    const permissions = classification.executionContext.permissions!;

    // 仓库自动读取 - 文件相关工具时显示（但有编辑文件工具时不显示）
    if (
      toolTypeChecks.isFileRelatedTool &&
      !environmentChecks.repoNotMatch &&
      !toolTypeChecks.hasEditFileTool
    ) {
      items.push({
        label: '仓库自动读取',
        checked: permissions.autoApprove,
        onChange: updateFunctions.updateAutoApprove,
        tip: tips.autoApproveTip,
      });
    }

    // Plan 自动执行 - 只有 todo 工具时显示（make_plan 不显示）
    if (toolTypeChecks.hasTodoTool && !toolTypeChecks.hasMakePlanTool) {
      items.push({
        label: 'Plan 自动执行',
        checked: permissions.autoTodo,
        onChange: updateFunctions.updateAutoTodo,
        tip: tips.autoTodoTip,
      });
    }

    // 代码自动应用 - 有编辑文件工具时显示
    if (toolTypeChecks.hasEditFileTool) {
      items.push({
        label: '代码自动应用',
        checked: permissions.autoApply,
        onChange: updateFunctions.updateAutoApply,
        tip: tips.autoApplyTip,
      });
    }

    // 命令自动执行 - 有终端工具时显示
    if (
      toolTypeChecks.hasTerminalTool &&
      environmentChecks.enableTerminal &&
      (environmentChecks.isVsCodeIDE || environmentChecks.isJetBrainsIDE)
    ) {
      items.push({
        label: '命令自动执行',
        checked: permissions.autoExecute,
        onChange: updateFunctions.updateAutoExecute,
        tip: tips.autoExecuteTip,
      });
    }

    // MCP自动调用 - 基于初始状态决定是否显示开关
    if (
      toolTypeChecks.hasMCPTool &&
      mcpToolInfo &&
      !mcpToolInfo.initialMCPAutoApprove
    ) {
      items.push({
        label: `${mcpToolInfo.mcpServerDisplayName} 自动调用`,
        checked: mcpToolInfo.mcpServer?.config?.autoApprove || false,
        onChange: mcpToolInfo.handleMcpSwitchChange,
        tip: mcpToolInfo.mcpAutoApproveTip,
      });
    }

    return items;
  }, [
    classification,
    isShare,
    toolTypeChecks,
    environmentChecks,
    mcpToolInfo,
    tips,
    updateFunctions,
  ]);

  // 返回完整的工具调用结果
  return {
    // 分类和环境
    classification,
    mcpToolInfo,
    tips,

    // 状态管理
    ...state,

    // 处理逻辑
    ...handlers,

    // 标题和显示
    ...titleInfo,

    // 通知
    ...notification,

    // 自动配置
    autoConfigItems,

    // 更新函数
    updateFunctions,

    // 便捷访问
    toolTypes: toolTypeChecks,
    environment: environmentChecks,
  };
}

// 导出类型，方便使用
export type {
  ToolCallResult,
  AutoConfigItem,
  ToolClassificationResult,
  MCPToolInfo,
  AutoConfigTips,
  ToolTypeChecks,
  EnvironmentChecks,
} from './../useToolCall/types';