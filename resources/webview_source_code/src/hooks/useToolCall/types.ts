/**
 * 工具调用Hook的通用类型定义
 */

import { ToolCall } from '../../services';
import { ExecutionContext } from '../../types/executionContext';

export interface ToolTypeChecks {
  hasEditFileTool: boolean;
  hasListFilesTool: boolean;
  hasReadFileTool: boolean;
  hasMCPTool: boolean;
  hasMakePlanTool: boolean;
  hasTodoTool: boolean;
  hasAskUserQuestionTool: boolean;
  hasTerminalTool: boolean;
  hasDangerousCommand: boolean;
  isFileRelatedTool: boolean;
  hasTaskTool: boolean;
}

export interface EnvironmentChecks {
  repoNotMatch: boolean;
  isVsCodeIDE: boolean;
  isJetBrainsIDE: boolean;
  enableTerminal: boolean;
}

export interface ToolClassificationResult {
  toolGroups: Map<string, ToolCall[]>;
  executionContext: ExecutionContext;
  hasTaskTools: boolean;
  hasMixedTools: boolean;
  hasMultipleSubagents: boolean;
  toolTypeChecks: ToolTypeChecks;
  environmentChecks: EnvironmentChecks;
}

export interface MCPToolInfo {
  mcpServerName: string | null;
  mcpServer: any;
  mcpServerDisplayName: string;
  initialMCPAutoApprove: boolean;
  handleMcpSwitchChange: (checked: boolean) => void;
  mcpAutoApproveTip: string;
}

export interface AutoConfigTips {
  autoApproveTip: React.ReactNode;
  autoApplyTip: string;
  autoExecuteTip: React.ReactNode;
  autoTodoTip: string;
  openExtensionSetting: () => void;
}

export interface ToolCallState {
  toolResponse: { [propName: string]: boolean };
  unselectedResults: Set<string>;
  toolResponseDisabled: boolean;
  hasToolCallError: boolean;
  pathList: string[];
  setToolResponse: React.Dispatch<React.SetStateAction<{ [propName: string]: boolean }>>;
  setUnselectedResults: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleSelectionChange: (id: string, isSelected: boolean, toolId: string) => void;
}

export interface ToolCallHandlers {
  handleToolCall: (accept: boolean) => void;
  execCommandTool: (accept: boolean) => void;
  getBtnLabel: (isAccept: boolean) => string;
}

export interface ToolCallTitleInfo {
  toolCallTitle: string;
  shouldShowHeader: boolean;
}

export interface NotificationState {
  hasNotifiedRef: React.MutableRefObject<boolean>;
}

export interface AutoConfigItem {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tip?: React.ReactNode;
}

export interface ToolCallResult {
  // 分类和环境
  classification: ToolClassificationResult;
  mcpToolInfo: MCPToolInfo | null;
  tips: AutoConfigTips;

  // 状态管理
  toolResponse: { [propName: string]: boolean };
  unselectedResults: Set<string>;
  toolResponseDisabled: boolean;
  hasToolCallError: boolean;
  pathList: string[];
  setToolResponse: React.Dispatch<React.SetStateAction<{ [propName: string]: boolean }>>;
  setUnselectedResults: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleSelectionChange: (id: string, isSelected: boolean, toolId: string) => void;

  // 处理逻辑
  handleToolCall: (accept: boolean) => void;
  execCommandTool: (accept: boolean) => void;
  getBtnLabel: (isAccept: boolean) => string;

  // 标题和显示
  toolCallTitle: string;
  shouldShowHeader: boolean;

  // 通知
  hasNotifiedRef: React.MutableRefObject<boolean>;

  // 自动配置
  autoConfigItems: AutoConfigItem[];

  // 更新函数
  updateFunctions: {
    updateAutoApprove: (checked: boolean) => void;
    updateAutoApply: (checked: boolean) => void;
    updateAutoExecute: (checked: boolean) => void;
    updateAutoTodo: (checked: boolean) => void;
  };

  // 便捷访问
  toolTypes: ToolTypeChecks;
  environment: EnvironmentChecks;
}